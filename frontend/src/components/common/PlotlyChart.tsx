import type { Data, Layout, Config } from "plotly.js";
import PlotlyImport from "plotly.js-basic-dist-min";
import factoryImport from "react-plotly.js/factory";

const Plotly: any = (PlotlyImport as any)?.default ?? PlotlyImport;
const createPlotlyComponent: any =
  (factoryImport as any)?.default ?? factoryImport;

const Plot = createPlotlyComponent(Plotly);

interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
  className?: string;
}

const config: Partial<Config> = {
  displayModeBar: false,
  responsive: true,
};

export function PlotlyChart({
  data,
  layout,
  className = "",
}: PlotlyChartProps) {
  return (
    <div className={className}>
      <Plot
        data={data}
        layout={{
          autosize: true,
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: {
            family: "Outfit, system-ui, sans-serif",
            color: "#384534",
          },
          margin: { l: 32, r: 16, t: 12, b: 36 },
          ...layout,
        }}
        config={config}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
