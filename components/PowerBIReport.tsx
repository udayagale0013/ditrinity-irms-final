'use client';

import { useEffect, useRef } from 'react';
import * as pbi from 'powerbi-client';

type PowerBIReportProps = {
  config: any;
};

export default function PowerBIReport({
  config,
}: PowerBIReportProps) {
  const reportContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reportContainerRef.current || !config?.embedToken) {
      return;
    }

    const powerBIService = new pbi.service.Service(
      pbi.factories.hpmFactory,
      pbi.factories.wpmpFactory,
      pbi.factories.routerFactory
    );

    const embedConfig = {
      type: 'report',
      id: config.reportId,
      embedUrl: config.embedUrl,
      accessToken: config.embedToken,
      tokenType: pbi.models.TokenType.Embed,

      // Keep report permissions enabled.
      permissions: pbi.models.Permissions.Read,

      settings: {
        panes: {
          filters: {
            visible: false,
          },
          pageNavigation: {
            visible: true,
          },
        },
        background: pbi.models.BackgroundType.Transparent,
      },
    };

    const report = powerBIService.embed(
      reportContainerRef.current,
      embedConfig as any
    );

    return () => {
      if (reportContainerRef.current) {
        powerBIService.reset(reportContainerRef.current);
      }

      report?.off?.('loaded');
    };
  }, [config]);

  return (
    <div
      ref={reportContainerRef}
      style={{
        height: '760px',
        width: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#f8fafc',
      }}
    />
  );
}