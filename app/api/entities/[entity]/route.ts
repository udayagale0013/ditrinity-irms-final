import { NextRequest } from 'next/server';
import { query, sqlIdent, withTransaction } from '@/lib/db';
import {
  ENTITIES,
  EXTENDED_ENTITIES,
  READ_ONLY,
  COMPOSITE_ENTITIES,
  type Entity,
} from '@/lib/entities';
import { requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const PROTECTED_FIELDS: Record<string, string[]> = {
  requirements: ['status'],
  allocations: ['status'],
  sow_approvals: ['status'],
  approval_cycles: ['status'],
  po_readiness: ['readiness_status'],
  releases: ['status'],
  timesheets: ['status', 'billing_ready'],
};

function validEntity(x: string): x is Entity {
  return (
    [...ENTITIES, ...EXTENDED_ENTITIES] as readonly string[]
  ).includes(x);
}

async function columns(entity: string) {
  const r = await query<{
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [entity]
  );

  return r.rows;
}

function normalize(v: unknown, type: string) {
  if (v === '' || v === undefined) return null;

  if (type === 'boolean') {
    return v === true || v === 'true' || v === '1';
  }

  if (
    [
      'integer',
      'bigint',
      'numeric',
      'double precision',
      'real',
      'smallint',
    ].includes(type)
  ) {
    return Number(v);
  }

  return v;
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const s = await requireSession();

  const { entity } = await params;

  if (!validEntity(entity)) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'ENTITY_NOT_ALLOWED',
        },
      },
      { status: 404 }
    );
  }

  const url = new URL(req.url);

  const page = Math.max(
    1,
    Number(url.searchParams.get('page') || 1)
  );

  const limit = Math.min(
    100,
    Math.max(
      1,
      Number(url.searchParams.get('limit') || 25)
    )
  );

  const search =
    url.searchParams.get('search')?.trim() || '';

  const meta =
    url.searchParams.get('meta') === '1';

  const cols = await columns(entity);

  /* ---------- Metadata ---------- */

  if (meta) {
    const pk = await query<{ column_name: string }>(
      `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `,
      [entity]
    );

    return Response.json({
      ok: true,
      entity,
      columns: cols,
      primaryKey: pk.rows.map(
        (x) => x.column_name
      ),
      readOnly: READ_ONLY.has(entity),
      singleId: pk.rows.length === 1,
    });
  }

  /* ---------- Search ---------- */

  const textCols = cols
    .filter((c) =>
      [
        'character varying',
        'text',
        'character',
      ].includes(c.data_type)
    )
    .map((c) => c.column_name);

  const where =
    textCols.length && search
      ? 'WHERE ' +
        textCols
          .map(
            (c) =>
              `${sqlIdent(c)} ILIKE $1`
          )
          .join(' OR ')
      : '';

  const count = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text count
      FROM ${sqlIdent(entity)}
      ${where}
    `,
    [...(search ? [`%${search}%`] : [])]
  );

  const rows = await query(
    `
      SELECT *
      FROM ${sqlIdent(entity)}
      ${where}
      ORDER BY 1 DESC
      LIMIT $${search ? 2 : 1}
      OFFSET $${search ? 3 : 2}
    `,
    [
      ...(search ? [`%${search}%`] : []),
      limit,
      (page - 1) * limit,
    ]
  );

  return Response.json({
    ok: true,
    entity,
    rows: rows.rows,
    total: Number(count.rows[0].count),
    page,
    limit,
    columns: cols,
    readOnly: READ_ONLY.has(entity),
    roles: s.roles,
  });
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const s = await requireSession();

  const { entity } = await params;

  if (
    !validEntity(entity) ||
    READ_ONLY.has(entity)
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'WRITE_NOT_ALLOWED',
        },
      },
      { status: 403 }
    );
  }

  const body = await req.json();
if (entity === 'requirements') {
  delete body.status;
}
  /*
   * -------------------------------------------------------
   * Protected fields
   *
   * For normal entities, protected fields are rejected.
   * Timesheets are handled specially below.
   * -------------------------------------------------------
   */



if (entity !== 'timesheets') {
  const blocked = (
    PROTECTED_FIELDS[entity] || []
  ).filter((k) =>
    Object.prototype.hasOwnProperty.call(
      body,
      k
    )
  );

  if (blocked.length) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'PROTECTED_STATE',
          message:
            `Protected fields ${blocked.join(
              ', '
            )} must be changed through their workflow API.`,
        },
      },
      { status: 403 }
    );
  }
}

  /*
   * -------------------------------------------------------
   * TIMESHEET CREATE WORKFLOW
   *
   * User should NOT control status/billing_ready
   * from the generic frontend form.
   *
   * New timesheet automatically starts as:
   *
   * status       = DRAFT
   * billing_ready = false
   * -------------------------------------------------------
   */

  if (entity === 'timesheets') {
    delete body.status;
    delete body.billing_ready;
  }

  const cols = await columns(entity);

  const allowed = cols
    .filter(
      (c) =>
        !c.column_default?.startsWith(
          'gen_random_uuid'
        ) &&
        !c.column_default?.includes('now()')
    )
    .map((c) => c.column_name);

  /*
   * Normal fields from frontend
   */
  const keys = Object.keys(body).filter((k) =>
    allowed.includes(k)
  );

  /*
   * -------------------------------------------------------
   * Add workflow-controlled timesheet fields
   * -------------------------------------------------------
   */

  if (entity === 'timesheets') {
    if (
      allowed.includes('status') &&
      !keys.includes('status')
    ) {
      keys.push('status');
      body.status = 'DRAFT';
    }

    if (
      allowed.includes('billing_ready') &&
      !keys.includes('billing_ready')
    ) {
      keys.push('billing_ready');
      body.billing_ready = false;
    }
  }

  if (!keys.length) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'NO_FIELDS',
        },
      },
      { status: 400 }
    );
  }

  const vals = keys.map((k) =>
    normalize(
      body[k],
      cols.find(
        (c) => c.column_name === k
      )!.data_type
    )
  );

  const placeholders = keys
    .map((_, i) => `$${i + 1}`)
    .join(',');

  const result = await withTransaction(
    async (client) => {
      /*
       * ---------------------------------------------------
       * INSERT
       * ---------------------------------------------------
       */

      const r = await client.query(
        `
          INSERT INTO ${sqlIdent(entity)}
          (${keys.map(sqlIdent).join(',')})
          VALUES (${placeholders})
          RETURNING *
        `,
        vals
      );

      const id =
        r.rows[0]?.id ??
        r.rows[0]?.[keys[0]] ??
        null;

      /*
       * ---------------------------------------------------
       * SOW workflow
       * ---------------------------------------------------
       */

      if (entity === 'sows' && id) {
        await client.query(
          `
            INSERT INTO sow_versions
              (sow_id, version_no, created_by)
            VALUES
              ($1, 1, $2)
            ON CONFLICT
              (sow_id, version_no)
            DO NOTHING
          `,
          [id, s.userId]
        );

        for (const role of [
          'RM',
          'CM',
          'BD',
          'OPS',
          'FINANCE',
        ]) {
          await client.query(
            `
              INSERT INTO sow_approvals
                (
                  sow_id,
                  version_id,
                  approver_role,
                  status
                )
              VALUES
                (
                  $1,
                  (
                    SELECT id
                    FROM sow_versions
                    WHERE sow_id = $1
                      AND version_no = 1
                  ),
                  $2,
                  'PENDING'
                )
            `,
            [id, role]
          );
        }

        const ext =
          await client.query(
            `
              SELECT
                to_regclass(
                  'public.approval_cycles'
                ) AS t
            `
          );

        if (ext.rows[0].t) {
          await client.query(
            `
              INSERT INTO approval_cycles
                (
                  sow_id,
                  version_id,
                  cycle_no,
                  status
                )
              VALUES
                (
                  $1,
                  (
                    SELECT id
                    FROM sow_versions
                    WHERE sow_id = $1
                      AND version_no = 1
                  ),
                  1,
                  'PENDING'
                )
              ON CONFLICT DO NOTHING
            `,
            [id]
          );
        }
      }

      /*
       * ---------------------------------------------------
       * AUDIT
       * ---------------------------------------------------
       */

      await audit(
        client,
        s.userId,
        'CREATE',
        entity,
        id,
        null,
        r.rows[0]
      );

      return r.rows[0];
    }
  );

  return Response.json(
    {
      ok: true,
      row: result,
    },
    { status: 201 }
  );
}

/* =========================================================
   PUT
   ========================================================= */

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const s = await requireSession();

  const { entity } = await params;

  if (
    !validEntity(entity) ||
    READ_ONLY.has(entity) ||
    COMPOSITE_ENTITIES.has(entity)
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'WRITE_NOT_ALLOWED',
        },
      },
      { status: 403 }
    );
  }

  const body = await req.json();

  /*
   * Protected fields cannot be updated
   * through generic PUT.
   */

  const blocked = (
    PROTECTED_FIELDS[entity] || []
  ).filter((k) =>
    Object.prototype.hasOwnProperty.call(
      body,
      k
    )
  );

  if (blocked.length) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'PROTECTED_STATE',
          message:
            `Protected fields ${blocked.join(
              ', '
            )} must be changed through their workflow API.`,
        },
      },
      { status: 403 }
    );
  }

  const id = String(body.id || '');

  if (!id) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'ID_REQUIRED',
        },
      },
      { status: 400 }
    );
  }

  const cols = await columns(entity);

  const pk = cols.find(
    (c) => c.column_name === 'id'
  )
    ? 'id'
    : cols[0].column_name;

  const keys = Object.keys(body).filter(
    (k) =>
      k !== pk &&
      k !== 'id' &&
      cols.some(
        (c) => c.column_name === k
      )
  );

  if (!keys.length) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'NO_FIELDS',
        },
      },
      { status: 400 }
    );
  }

  const vals = keys.map((k) =>
    normalize(
      body[k],
      cols.find(
        (c) => c.column_name === k
      )!.data_type
    )
  );

  const result = await withTransaction(
    async (client) => {
      /*
       * Get existing record
       */

      const old = await client.query(
        `
          SELECT *
          FROM ${sqlIdent(entity)}
          WHERE ${sqlIdent(pk)} = $1
        `,
        [id]
      );

      if (!old.rowCount) {
        throw new Error('NOT_FOUND');
      }

      /*
       * Update
       */

      const set = keys
        .map(
          (k, i) =>
            `${sqlIdent(k)} = $${i + 1}`
        )
        .join(',');

      const r = await client.query(
        `
          UPDATE ${sqlIdent(entity)}
          SET ${set}
          WHERE ${sqlIdent(pk)} = $${keys.length + 1}
          RETURNING *
        `,
        [...vals, id]
      );

      /*
       * Audit
       */

      await audit(
        client,
        s.userId,
        'UPDATE',
        entity,
        id,
        old.rows[0],
        r.rows[0]
      );

      return r.rows[0];
    }
  );

  return Response.json({
    ok: true,
    row: result,
  });
}

/* =========================================================
   DELETE
   ========================================================= */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const s = await requireSession();

  const { entity } = await params;

  if (
    !validEntity(entity) ||
    READ_ONLY.has(entity) ||
    COMPOSITE_ENTITIES.has(entity)
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'DELETE_NOT_ALLOWED',
        },
      },
      { status: 403 }
    );
  }

  const url = new URL(req.url);

  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'ID_REQUIRED',
        },
      },
      { status: 400 }
    );
  }

  const cols = await columns(entity);

  const pk = cols.find(
    (c) => c.column_name === 'id'
  )
    ? 'id'
    : cols[0].column_name;

  const result = await withTransaction(
    async (client) => {
      /*
       * Get old record
       */

      const old = await client.query(
        `
          SELECT *
          FROM ${sqlIdent(entity)}
          WHERE ${sqlIdent(pk)} = $1
        `,
        [id]
      );

      if (!old.rowCount) {
        throw new Error('NOT_FOUND');
      }

      /*
       * Delete
       */

      await client.query(
        `
          DELETE FROM ${sqlIdent(entity)}
          WHERE ${sqlIdent(pk)} = $1
        `,
        [id]
      );

      /*
       * Audit
       */

      await audit(
        client,
        s.userId,
        'DELETE',
        entity,
        id,
        old.rows[0],
        null
      );

      return old.rows[0];
    }
  );

  return Response.json({
    ok: true,
    row: result,
  });
}