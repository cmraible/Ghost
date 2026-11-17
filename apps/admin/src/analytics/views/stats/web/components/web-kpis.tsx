import {
  BarChartLoadingIndicator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsList,
} from '@tryghost/shade/components';
import {
  GhAreaChart,
  KpiDropdownButton,
  KpiTabTrigger,
  KpiTabValue,
} from '@tryghost/shade/patterns';
import { KPI_METRICS } from '@/analytics/views/stats/web/web-kpi-metrics';
import { formatDuration, formatNumber, formatPercentage, getYRange } from '@tryghost/shade/utils';
import { getEffectiveChartRange, sanitizeChartData } from '@/shared/analytics/chart-helpers';
import { useMemo, useRef, useState } from 'react';
import { Stack, Box } from '@tryghost/shade/primitives';
import { ChartError } from '@/shared/analytics/chart-error';

export interface KpiDataItem {
  date: string;
  [key: string]: string | number;
}

interface WebKPIsProps {
  data: KpiDataItem[] | null;
  range: number;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => Promise<void>;
  isRetrying: boolean;
}

const WebKPIs: React.FC<WebKPIsProps> = ({
  data,
  range,
  isLoading,
  error,
  onRetry,
  isRetrying,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const unavailable = data === null && (Boolean(error) || isRetrying);
  const [currentTab, setCurrentTab] = useState('visits');
  const currentMetric = KPI_METRICS[currentTab];

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return (
      sanitizeChartData<KpiDataItem>(
        data,
        range,
        currentMetric.dataKey as keyof KpiDataItem,
        'sum',
      )?.map((item: KpiDataItem) => {
        const value = Number(item[currentMetric.dataKey]);
        return {
          date: String(item.date),
          value,
          formattedValue: currentMetric.formatter(value),
          label: currentMetric.label,
        };
      }) || []
    );
  }, [data, range, currentMetric]);

  const chartRange = useMemo(() => {
    return getEffectiveChartRange(range, data || [], {
      fieldName: currentMetric.dataKey as keyof KpiDataItem,
    });
  }, [data, range, currentMetric]);

  // Calculate KPI values
  const getKpiValues = () => {
    if (!data?.length) {
      return { visits: 0, views: 0, bounceRate: 0, duration: 0 };
    }

    const totalVisits = data.reduce((sum, item) => sum + Number(item.visits), 0);
    const totalViews = data.reduce((sum, item) => sum + Number(item.pageviews), 0);

    // Ponderated KPIs calculation
    const _ponderatedKPIsTotal = (kpi: keyof (typeof data)[0]) => {
      return data.reduce((prev, curr) => {
        const currValue = Number(curr[kpi] ?? 0);
        const currVisits = Number(curr.visits);
        return prev + (currValue * currVisits) / totalVisits;
      }, 0);
    };

    const avgBounceRate = _ponderatedKPIsTotal('bounce_rate');
    const avgDuration = _ponderatedKPIsTotal('avg_session_sec');

    return {
      visits: formatNumber(totalVisits),
      views: formatNumber(totalViews),
      bounceRate: formatPercentage(avgBounceRate),
      duration: formatDuration(avgDuration),
    };
  };

  const kpiValues = getKpiValues();

  if (isLoading && !isRetrying) {
    return (
      <Stack align="center" className="-mb-6 h-[calc(16vw+132px)] w-full">
        <BarChartLoadingIndicator />
      </Stack>
    );
  }

  return (
    <Tabs
      ref={chartRef}
      aria-label="Traffic data"
      data-testid="web-graph"
      defaultValue="visits"
      role="region"
      tabIndex={-1}
      variant="kpis"
    >
      <TabsList className="-mx-6 hidden grid-cols-2 md:visible! md:grid!">
        <KpiTabTrigger
          aria-label={unavailable ? 'Unique visitors: Unavailable' : undefined}
          value="visits"
          onClick={() => setCurrentTab('visits')}
        >
          <KpiTabValue
            color="var(--chart-blue)"
            label="Unique visitors"
            value={unavailable ? '—' : kpiValues.visits}
          />
        </KpiTabTrigger>
        <KpiTabTrigger
          aria-label={unavailable ? 'Total views: Unavailable' : undefined}
          value="views"
          onClick={() => setCurrentTab('views')}
        >
          <KpiTabValue
            color="var(--chart-teal)"
            label="Total views"
            value={unavailable ? '—' : kpiValues.views}
          />
        </KpiTabTrigger>
      </TabsList>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={
            unavailable
              ? currentTab === 'visits'
                ? 'Unique visitors: Unavailable'
                : 'Total views: Unavailable'
              : undefined
          }
          className="md:hidden"
          asChild
        >
          <KpiDropdownButton>
            {currentTab === 'visits' && (
              <KpiTabValue
                color="var(--chart-blue)"
                label="Unique visitors"
                value={unavailable ? '—' : kpiValues.visits}
              />
            )}
            {currentTab === 'views' && (
              <KpiTabValue
                color="var(--chart-teal)"
                label="Total views"
                value={unavailable ? '—' : kpiValues.views}
              />
            )}
          </KpiDropdownButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setCurrentTab('visits')}>
            Unique visitors
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCurrentTab('views')}>Total views</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!unavailable && (error || isRetrying) && (
        <ChartError
          className="mt-4"
          description="Showing previously loaded data. Try again to update it."
          isRetrying={isRetrying}
          recoveryFocusRef={chartRef}
          title="Couldn’t refresh traffic data"
          variant="inline"
          onRetry={onRetry}
        />
      )}
      <Box className="my-4 [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground">
        {unavailable ? (
          <ChartError
            className="-mb-3 h-[16vw] max-h-[320px] min-h-[180px] w-full"
            description="Try loading this chart again."
            isRetrying={isRetrying}
            recoveryFocusRef={chartRef}
            title="Unable to load traffic data"
            onRetry={onRetry}
          />
        ) : (
          <GhAreaChart
            className="-mb-3 h-[16vw] max-h-[320px] min-h-[180px] w-full"
            color={currentMetric.color}
            data={chartData}
            id="mrr"
            range={chartRange}
            showHours={true}
            yAxisRange={[0, getYRange(chartData).max]}
          />
        )}
      </Box>
    </Tabs>
  );
};

export default WebKPIs;
