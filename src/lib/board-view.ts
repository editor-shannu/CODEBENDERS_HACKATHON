import "server-only";
import { buildForecastInput, loadBoard, reminderPayload, type ReminderPayload } from "./data";
import { runForecast } from "./forecast";
import { buildBrief } from "./munshi/rules";
import { db } from "./db";

/** Everything the dashboard needs, computed once per request. */
export async function loadDashboard() {
  const board = await loadBoard();
  const input = buildForecastInput(board);
  const forecast = runForecast(input);
  const pendingClaims = await db.paymentClaim.count({ where: { status: "PENDING" } });
  const brief = buildBrief({ families: board.families, today: board.today, forecast, pendingClaims });
  const payloads: Record<string, ReminderPayload> = {};
  for (const f of board.families) if (f.stats.balance > 0) payloads[f.id] = reminderPayload(f, board.settings, board.today);
  return { board, input, forecast, brief, payloads, pendingClaims };
}
