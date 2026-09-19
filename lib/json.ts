export function json(data: unknown, init?: ResponseInit) { return Response.json(data, init); }
export function error(message: string, status=400, code='BAD_REQUEST') { return Response.json({ok:false,error:{code,message}}, {status}); }
