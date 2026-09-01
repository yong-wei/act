# Owner conflicts

Ambiguity is retained. This projection does not choose an owner or migrate callers.

| id | identity | current evidence | candidates | consumer class | finding |
| --- | --- | --- | --- | --- | --- |
| owner-conflict:src/features/adaptive vs src/features/personalization | src/features/adaptive vs src/features/personalization | feature:adaptive; feature:personalization | personalization; platform | production | unresolved |
| owner-conflict:src/features/adaptive-assessment vs src/features/assessment | src/features/adaptive-assessment vs src/features/assessment | feature:adaptive-assessment; feature:assessment | assessment; knowledge; learning-record | production | unresolved |
| owner-conflict:src/lib/adaptive-* and src/lib/adaptive-planning | src/lib/adaptive-* and src/lib/adaptive-planning | lib:shared | assessment; personalization; platform | production | unresolved |
