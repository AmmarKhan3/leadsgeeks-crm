import Link from "next/link";
import type { AccountRow, AccountExtras } from "@/lib/data";
import { StatusPill, ApprovalChip, Person, TeamStack, Tags, Progress, Pill, Empty } from "./ui";
import { Money } from "./money";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The accounts table from the prototype: business, industry, status, CS owner, backend, services, access, last report, MRR. */
export function AccountsTable({ rows, extras, compact, showMoney, emptyTitle, emptyText }: { rows: AccountRow[]; extras: Map<string, AccountExtras>; compact?: boolean; showMoney?: boolean; emptyTitle?: string; emptyText?: string }) {
  if (!rows.length) return <Empty icon="inbox" title={emptyTitle ?? "No accounts here"} text={emptyText ?? "Nothing matches these filters."} />;
  return (
    <div className="tablewrap">
      <table className={`tbl ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th>Business</th>
            <th>Industry</th>
            <th>Status</th>
            <th>CS owner</th>
            <th>Backend</th>
            {compact ? null : <th>Services</th>}
            <th>Access</th>
            <th>Last report</th>
            {showMoney && !compact ? <th className="r">MRR</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const x = extras.get(a.id);
            return (
              <tr key={a.id} className="clickable">
                <td>
                  <Link href={`/accounts/${a.id}`} className="biz rowlink">{a.business}</Link>
                  <span className="sub">
                    {a.city}, {a.state}
                  </span>
                </td>
                <td>{a.industry}</td>
                <td>
                  <StatusPill status={a.status} /> <ApprovalChip approval={a.approval} />
                </td>
                <td>
                  <Person name={a.cs?.name} role="cs" size="sm" />
                </td>
                <td>
                  <TeamStack backend={a.backend} />
                </td>
                {compact ? null : (
                  <td>
                    <Tags items={a.services} max={3} />
                  </td>
                )}
                <td>{x ? <Progress have={x.access.have} total={x.access.total} /> : null}</td>
                <td>{x?.missingReport ? <Pill tone="bad">Missing</Pill> : x?.lastReport ? <span className="nowrap">{MONTHS[Number(x.lastReport.slice(5, 7)) - 1]} {x.lastReport.slice(0, 4)}</span> : <span className="faint">—</span>}</td>
                {showMoney && !compact ? (
                  <td className="r num">
                    <Money value={x?.mrr ?? 0} />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
