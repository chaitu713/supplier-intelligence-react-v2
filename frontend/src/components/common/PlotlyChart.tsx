import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
} from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts, SetOptionOpts } from "echarts/core";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  GraphicComponent,
  CanvasRenderer,
]);

type EChartsOption = Record<string, any>;
type ChartSeriesOption = Record<string, any>;

interface PlotlyChartProps {
  data: Array<Record<string, any>>;
  layout: Record<string, any>;
  className?: string;
}

const riskColors = {
  text: "#384534",
  muted: "#64748b",
  grid: "rgba(148, 163, 184, 0.18)",
  border: "rgba(17,22,18,0.08)",
};

export function PlotlyChart({
  data,
  layout,
  className = "",
}: PlotlyChartProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const option = useMemo(() => toEChartsOption(data, layout), [data, layout]);

  useEffect(() => {
    if (!elementRef.current) return;

    chartRef.current = echarts.init(elementRef.current, undefined, {
      renderer: "canvas",
    });

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const opts: SetOptionOpts = { notMerge: true, lazyUpdate: true };
    chartRef.current?.setOption(option, opts);
  }, [option]);

  return <div ref={elementRef} className={`plotly-frame ${className}`.trim()} />;
}

function toEChartsOption(
  data: Array<Record<string, any>>,
  layout: Record<string, any>,
): EChartsOption {
  const hasPie = data.some((series) => series.type === "pie");
  const hasHorizontalBar = data.some(
    (series) => series.type === "bar" && series.orientation === "h",
  );
  const hasSecondaryYAxis = !hasHorizontalBar && !hasPie && !!layout.yaxis2;
  const firstCartesian = data.find((series) => series.type !== "pie") ?? {};
  const categoryAxisValues = hasHorizontalBar
    ? firstCartesian.y ?? []
    : firstCartesian.x ?? [];

  return {
    backgroundColor: "transparent",
    animationDuration: 650,
    animationEasing: "cubicOut",
    color: collectPalette(data),
    tooltip: {
      trigger: hasPie ? "item" : "axis",
      axisPointer: {
        type: "none",
      },
      backgroundColor: "#ffffff",
      borderColor: riskColors.border,
      borderWidth: 1,
      textStyle: {
        color: "#243126",
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize: 12,
      },
      extraCssText: "box-shadow: 0 8px 24px rgba(17,22,18,0.10); border-radius: 10px;",
    },
    legend: buildLegend(layout, hasPie),
    graphic: hasPie ? buildCenterGraphic(layout) : undefined,
    grid: hasPie
      ? undefined
      : {
          top: normalizeMargin(layout.margin?.t, layout.legend ? 44 : 18, 0),
          right: normalizeMargin(layout.margin?.r, 24),
          bottom: normalizeMargin(layout.margin?.b, 42),
          left: normalizeMargin(layout.margin?.l, hasHorizontalBar ? 120 : 48),
          containLabel: true,
        },
    xAxis: hasPie
      ? undefined
      : buildAxis({
          type: hasHorizontalBar ? "value" : "category",
          data: hasHorizontalBar ? undefined : categoryAxisValues,
          source: layout.xaxis,
          rotate: layout.xaxis?.tickangle,
        }),
    yAxis: hasPie
      ? undefined
      : hasSecondaryYAxis
        ? [
            buildAxis({
              type: "value",
              source: layout.yaxis,
            }),
            buildAxis({
              type: "value",
              source: layout.yaxis2,
              position: "right",
              showSplitLine: false,
            }),
          ]
        : buildAxis({
            type: hasHorizontalBar ? "category" : "value",
            data: hasHorizontalBar ? categoryAxisValues : undefined,
            source: layout.yaxis,
            inverse: hasHorizontalBar,
          }),
    series: data.map((series) => toSeries(series, hasHorizontalBar)),
  };
}

function toSeries(series: Record<string, any>, hasHorizontalBar: boolean): ChartSeriesOption {
  if (series.type === "pie") {
    const values = series.values ?? [];
    const labels = series.labels ?? [];
    const innerRadius = series.hole ? Math.max(42, Math.round(series.hole * 78)) : 0;
    return {
      type: "pie",
      radius: series.hole ? [`${innerRadius}%`, "78%"] : ["0%", "78%"],
      center: ["50%", "50%"],
      minAngle: 3,
      padAngle: 2,
      avoidLabelOverlap: true,
      label: {
        show: series.textinfo !== "none",
        color: riskColors.text,
        fontFamily: "Outfit, system-ui, sans-serif",
        fontSize: 12,
      },
      labelLine: {
        length: 10,
        length2: 8,
        lineStyle: { color: "rgba(56, 69, 52, 0.32)" },
      },
      itemStyle: {
        borderColor: "#ffffff",
        borderWidth: 4,
        shadowBlur: 8,
        shadowColor: "rgba(17, 22, 18, 0.06)",
      },
      emphasis: {
        scale: true,
        scaleSize: 5,
        itemStyle: {
          shadowBlur: 14,
          shadowColor: "rgba(17, 22, 18, 0.12)",
        },
      },
      data: labels.map((label: string, index: number) => ({
        name: label,
        value: values[index],
        itemStyle: { color: series.marker?.colors?.[index] },
      })),
    };
  }

  if (series.type === "scatter") {
    const isLine = String(series.mode ?? "").includes("lines");
    return {
      type: isLine ? "line" : "scatter",
      name: series.name,
      smooth: true,
      symbolSize: series.marker?.size ?? 7,
      showSymbol: true,
      lineStyle: {
        color: series.line?.color,
        width: series.line?.width ?? 2.5,
      },
      itemStyle: {
        color: series.marker?.color ?? series.line?.color,
      },
      areaStyle: series.fill
        ? {
            color: series.fillcolor ?? "rgba(22, 101, 52, 0.08)",
          }
        : undefined,
      yAxisIndex: series.yaxis === "y2" ? 1 : 0,
      data: zipXY(series.x ?? [], series.y ?? []),
    };
  }

  const values = hasHorizontalBar ? series.x ?? [] : series.y ?? [];
  const categories = hasHorizontalBar ? series.y ?? [] : series.x ?? [];

  return {
    type: "bar",
    name: series.name,
    yAxisIndex: series.yaxis === "y2" ? 1 : 0,
    barMaxWidth: hasHorizontalBar ? 42 : 46,
    barWidth: series.barWidth,
    barGap: series.barGap,
    barCategoryGap: series.barCategoryGap ?? (hasHorizontalBar ? "30%" : "24%"),
    stack: series.stack,
    label: {
      show: series.textposition === "outside" || series.textposition === "auto",
      position: hasHorizontalBar ? "right" : "top",
      color: riskColors.text,
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 11,
      formatter: (params: any) => series.text?.[params.dataIndex] ?? params.value,
    },
    itemStyle: {
      borderRadius: hasHorizontalBar ? [0, 7, 7, 0] : [7, 7, 0, 0],
      color: (params: any) => {
        const markerColor = series.marker?.color;
        return Array.isArray(markerColor) ? markerColor[params.dataIndex] : markerColor;
      },
    },
    data: categories.map((category: string, index: number) => ({
      name: category,
      value: values[index],
      itemStyle: {
        color: Array.isArray(series.marker?.color)
          ? series.marker.color[index]
          : series.marker?.color,
      },
    })),
  };
}

function buildCenterGraphic(layout: Record<string, any>) {
  const annotationText = layout.annotations?.[0]?.text;
  if (!annotationText) return undefined;

  const lines = stripHtml(annotationText).split(/\s+/).filter(Boolean);
  const primary = lines[0] ?? "";
  const secondary = lines.slice(1).join(" ");

  return [
    {
      type: "group",
      left: "center",
      top: "center",
      bounding: "raw",
      children: [
        {
          type: "text",
          style: {
            text: primary,
            x: 0,
            y: secondary ? -10 : -2,
            textAlign: "center",
            textVerticalAlign: "middle",
            fill: "#111612",
            font: "600 22px Outfit, system-ui, sans-serif",
          },
        },
        {
          type: "text",
          silent: true,
          style: {
            text: secondary,
            x: 0,
            y: 14,
            textAlign: "center",
            textVerticalAlign: "middle",
            fill: "#778a71",
            font: "600 10px Outfit, system-ui, sans-serif",
          },
        },
      ],
    },
  ];
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAxis({
  type,
  data,
  source,
  rotate,
  inverse,
  position,
  showSplitLine,
}: {
  type: "category" | "value";
  data?: string[];
  source?: Record<string, any>;
  rotate?: number;
  inverse?: boolean;
  position?: "left" | "right";
  showSplitLine?: boolean;
}) {
  return {
    type,
    data,
    inverse,
    position,
    min: source?.min,
    max: source?.max,
    name: source?.title?.text,
    nameLocation: "middle",
    nameGap: 34,
    nameTextStyle: {
      color: riskColors.muted,
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 12,
    },
    axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.34)" } },
    axisTick: { show: false },
    axisLabel: {
      color: source?.tickfont?.color ?? riskColors.muted,
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: source?.tickfont?.size ?? 11,
      rotate,
      hideOverlap: true,
    },
    splitLine: {
      show: showSplitLine ?? type === "value",
      lineStyle: { color: source?.gridcolor ?? riskColors.grid },
    },
  };
}

function buildLegend(layout: Record<string, any>, hasPie: boolean) {
  const showLegend = layout.showlegend !== false && (hasPie || !!layout.legend);
  return {
    show: showLegend,
    top: 0,
    left: 0,
    orient: "horizontal",
    itemWidth: 10,
    itemHeight: 10,
    textStyle: {
      color: riskColors.text,
      fontFamily: "Outfit, system-ui, sans-serif",
      fontSize: 11,
    },
  };
}

function collectPalette(data: Array<Record<string, any>>): string[] {
  const colors = data.flatMap((series) => {
    if (Array.isArray(series.marker?.colors)) return series.marker.colors;
    if (Array.isArray(series.marker?.color)) return series.marker.color;
    if (series.marker?.color) return [series.marker.color];
    if (series.line?.color) return [series.line.color];
    return [];
  });

  return colors.length
    ? colors
    : ["#166534", "#2563eb", "#f59e0b", "#dc2626", "#0f766e", "#7c3aed"];
}

function zipXY(xValues: any[], yValues: any[]) {
  return xValues.map((x, index) => [x, yValues[index]]);
}

function normalizeMargin(value: unknown, fallback: number, min = 12) {
  return typeof value === "number" ? Math.max(min, value) : fallback;
}
