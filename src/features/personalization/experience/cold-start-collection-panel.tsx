import type { ColdStartCollectionProjection } from '@/lib/cold-start-evidence-collection';

export function ColdStartCollectionPanel({
  projection,
}: {
  projection: ColdStartCollectionProjection;
}) {
  if (projection.insufficientDimensions.length === 0) return null;

  return (
    <div className="mt-4 space-y-3" data-adaptive-path-cold-start-collection="panel">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs font-medium text-subtle">当前证据限制</p>
        <ul className="mt-2 grid gap-2 text-sm">
          {projection.limitationTexts.map((text) => (
            <li key={text} className="leading-6 text-foreground">{text}</li>
          ))}
        </ul>
      </div>
      {projection.activities.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-subtle">补充学习证据</p>
          <ul className="mt-2 grid gap-2 text-sm">
            {projection.activities.map((activity) => (
              <li key={activity.resourceId}>
                <a
                  href={activity.href}
                  className="font-medium text-foreground hover:text-primary"
                  data-adaptive-path-cold-start-collection={activity.type}
                >
                  {activity.title}
                </a>
                <p className="mt-1 leading-6 text-subtle">{activity.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
