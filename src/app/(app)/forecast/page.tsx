import { PageHeader } from "@/components/ui/Card";
import { Guard } from "@/components/setup/Guard";
import { TimeMachine } from "@/components/forecast/TimeMachine";
import { buildForecastInput, loadBoard } from "@/lib/data";
import { monthKey, addMonths, monthStart } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function ForecastPage() {
  return (
    <Guard>
      {async () => {
        const board = await loadBoard();
        const input = buildForecastInput(board);
        return (
          <div>
            <PageHeader title="Forecast" kicker="Cash cone · next 30, 60 or 90 days" />
            <TimeMachine input={input} month={monthKey(addMonths(monthStart(board.today), 1))} />
          </div>
        );
      }}
    </Guard>
  );
}
