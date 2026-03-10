#!/usr/bin/env python3
"""同步课表到 macOS Calendar（支持 dry-run / apply）。"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from typing import Any

COURSE_WEEKS = list(range(1, 8)) + list(range(9, 13))
COURSE_SLOTS = [
    ('Tue12', 1, dt.time(8, 30), dt.time(10, 5), '笃学楼-408'),
    ('Wed34', 2, dt.time(10, 25), dt.time(12, 0), '笃学楼-308'),
    ('Thu34', 3, dt.time(10, 25), dt.time(12, 0), '笃学楼-211'),
]
WEEK_TITLE_RE = re.compile(r'^Week\s?\d{2}$')


class CalendarSyncError(RuntimeError):
    pass


def parse_date(value: str) -> dt.date:
    return dt.datetime.strptime(value, '%Y-%m-%d').date()


def build_course_events(week1_monday: dt.date, course_name: str = '自动控制原理') -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for week in COURSE_WEEKS:
        for _, weekday_offset, start_t, end_t, location in COURSE_SLOTS:
            day = week1_monday + dt.timedelta(weeks=week - 1, days=weekday_offset)
            start_dt = dt.datetime.combine(day, start_t)
            end_dt = dt.datetime.combine(day, end_t)
            events.append(
                {
                    'week': week,
                    'start': start_dt,
                    'end': end_dt,
                    'all_day': False,
                    'location': location,
                    'title': '',
                }
            )
    events.sort(key=lambda item: item['start'])
    for i, event in enumerate(events, 1):
        event['title'] = f'{course_name}L{i:02d}'
    return events


def build_week_events(week1_monday: dt.date, week_count: int = 20) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for i in range(1, week_count + 1):
        day = week1_monday + dt.timedelta(weeks=i - 1)
        start_dt = dt.datetime.combine(day, dt.time(0, 0))
        end_dt = start_dt + dt.timedelta(days=1)
        events.append(
            {
                'title': f'Week{i:02d}',
                'start': start_dt,
                'end': end_dt,
                'all_day': True,
                'location': '',
            }
        )
    return events


def is_week_title(title: str) -> bool:
    return WEEK_TITLE_RE.match(title) is not None


def _month_name(month: int) -> str:
    names = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ]
    return names[month - 1]


def _escape_applescript(value: str) -> str:
    return value.replace('\\', '\\\\').replace('"', '\\"')


def _run_osascript(script: str) -> str:
    proc = subprocess.run(
        ['osascript', '-e', script],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise CalendarSyncError(proc.stderr.strip() or 'osascript 执行失败')
    return proc.stdout.strip()


def _build_list_script(calendar_name: str, start_dt: dt.datetime, end_dt: dt.datetime) -> str:
    cal = _escape_applescript(calendar_name)
    sm = _month_name(start_dt.month)
    em = _month_name(end_dt.month)
    return f'''
on esc(v)
    set s to (v as text)
    set AppleScript's text item delimiters to "|"
    set parts1 to text items of s
    set AppleScript's text item delimiters to "/"
    set s to parts1 as text
    set AppleScript's text item delimiters to tab
    set parts2 to text items of s
    set AppleScript's text item delimiters to " "
    set s to parts2 as text
    set AppleScript's text item delimiters to return
    set parts3 to text items of s
    set AppleScript's text item delimiters to " "
    set s to parts3 as text
    set AppleScript's text item delimiters to ""
    return s
end esc

set calName to "{cal}"
set startBound to current date
set year of startBound to {start_dt.year}
set month of startBound to {sm}
set day of startBound to {start_dt.day}
set time of startBound to {(start_dt.hour * 3600) + (start_dt.minute * 60)}

set endBound to current date
set year of endBound to {end_dt.year}
set month of endBound to {em}
set day of endBound to {end_dt.day}
set time of endBound to {(end_dt.hour * 3600) + (end_dt.minute * 60)}

tell application "Calendar"
    if not (exists calendar calName) then
        return "__CAL_NOT_FOUND__"
    end if
    set calRef to calendar calName
    set rows to {{}}
    set scopedEvents to (every event of calRef whose start date ≥ startBound and start date < endBound)
    repeat with ev in scopedEvents
        set sd to start date of ev
        set ed to end date of ev
        set s1 to ((year of sd as integer) as text) & "," & ((month of sd as integer) as text) & "," & ((day of sd as integer) as text) & "," & ((hours of sd as integer) as text) & "," & ((minutes of sd as integer) as text)
        set s2 to ((year of ed as integer) as text) & "," & ((month of ed as integer) as text) & "," & ((day of ed as integer) as text) & "," & ((hours of ed as integer) as text) & "," & ((minutes of ed as integer) as text)
        set isAllDay to (allday event of ev) as text
        set titleText to my esc(summary of ev)
        set locText to my esc(location of ev)
        set lineText to s1 & "|" & s2 & "|" & isAllDay & "|" & titleText & "|" & locText
        copy lineText to end of rows
    end repeat
    set AppleScript's text item delimiters to linefeed
    return rows as text
end tell
'''


def _parse_event_rows(raw: str) -> list[dict[str, Any]]:
    if not raw:
        return []
    rows = [row for row in raw.splitlines() if row.strip()]
    events: list[dict[str, Any]] = []
    for row in rows:
        parts = row.split('|')
        if len(parts) != 5:
            continue
        s1, s2, all_day, title, location = parts
        y1, mo1, d1, h1, mi1 = [int(x) for x in s1.split(',')]
        y2, mo2, d2, h2, mi2 = [int(x) for x in s2.split(',')]
        start = dt.datetime(y1, mo1, d1, h1, mi1)
        end = dt.datetime(y2, mo2, d2, h2, mi2)
        events.append(
            {
                'start': start,
                'end': end,
                'all_day': all_day.lower() == 'true',
                'title': title,
                'location': location,
            }
        )
    return events


def list_events(calendar_name: str, start_dt: dt.datetime, end_dt: dt.datetime) -> list[dict[str, Any]]:
    script = _build_list_script(calendar_name, start_dt, end_dt)
    raw = _run_osascript(script)
    if raw == '__CAL_NOT_FOUND__':
        raise CalendarSyncError(f'未找到日历: {calendar_name}')
    return _parse_event_rows(raw)


def _build_apply_script(
    calendar_name: str,
    target_events: list[dict[str, Any]],
    start_dt: dt.datetime,
    end_dt: dt.datetime,
    delete_predicate: str,
) -> str:
    cal = _escape_applescript(calendar_name)
    sm = _month_name(start_dt.month)
    em = _month_name(end_dt.month)

    create_lines: list[str] = []
    for event in target_events:
        title = _escape_applescript(event['title'])
        location = _escape_applescript(event.get('location', ''))
        s = event['start']
        e = event['end']
        create_lines.append(
            f'''
    set sDate to current date
    set year of sDate to {s.year}
    set month of sDate to {_month_name(s.month)}
    set day of sDate to {s.day}
    set time of sDate to {(s.hour * 3600) + (s.minute * 60)}

    set eDate to current date
    set year of eDate to {e.year}
    set month of eDate to {_month_name(e.month)}
    set day of eDate to {e.day}
    set time of eDate to {(e.hour * 3600) + (e.minute * 60)}

    if {str(bool(event['all_day'])).lower()} then
        make new event at end with properties {{summary:"{title}", start date:sDate, end date:eDate, allday event:true}}
    else
        make new event at end with properties {{summary:"{title}", start date:sDate, end date:eDate, location:"{location}"}}
    end if
'''
        )

    create_block = '\n'.join(create_lines)

    return f'''
set calName to "{cal}"
set startBound to current date
set year of startBound to {start_dt.year}
set month of startBound to {sm}
set day of startBound to {start_dt.day}
set time of startBound to {(start_dt.hour * 3600) + (start_dt.minute * 60)}

set endBound to current date
set year of endBound to {end_dt.year}
set month of endBound to {em}
set day of endBound to {end_dt.day}
set time of endBound to {(end_dt.hour * 3600) + (end_dt.minute * 60)}

tell application "Calendar"
    if not (exists calendar calName) then
        return "__CAL_NOT_FOUND__"
    end if
    tell calendar calName
        set deletedCount to 0
        set scopedEvents to (every event whose start date ≥ startBound and start date < endBound)
        repeat with ev in scopedEvents
            set shouldDelete to ({delete_predicate})
            if shouldDelete then
                delete ev
                set deletedCount to deletedCount + 1
            end if
        end repeat

{create_block}
        return "deleted=" & deletedCount & ",created=" & {len(target_events)}
    end tell
end tell
'''


def _course_delete_predicate(course_name: str) -> str:
    name = _escape_applescript(course_name)
    return f'(summary of ev starts with "{name}")'


def _week_delete_predicate() -> str:
    return '(summary of ev starts with "Week")'


def summarize(
    teaching_existing: list[dict[str, Any]],
    work_existing: list[dict[str, Any]],
    course_targets: list[dict[str, Any]],
    week_targets: list[dict[str, Any]],
    course_name: str,
) -> str:
    course_existing = [ev for ev in teaching_existing if ev['title'].startswith(course_name)]
    week_existing = [ev for ev in work_existing if is_week_title(ev['title'])]

    lines = [
        '=== Dry Run Summary ===',
        f'教学日历：匹配到现有课程事件 {len(course_existing)} 条，计划重建 {len(course_targets)} 条。',
        f'工作日历：匹配到现有 Week 事件 {len(week_existing)} 条，计划重建 {len(week_targets)} 条。',
        f'课程首条：{course_targets[0]["title"]} @ {course_targets[0]["start"]:%Y-%m-%d %H:%M} {course_targets[0]["location"]}',
        f'课程末条：{course_targets[-1]["title"]} @ {course_targets[-1]["start"]:%Y-%m-%d %H:%M} {course_targets[-1]["location"]}',
        f'周标首条：{week_targets[0]["title"]} @ {week_targets[0]["start"]:%Y-%m-%d}',
        f'周标末条：{week_targets[-1]["title"]} @ {week_targets[-1]["start"]:%Y-%m-%d}',
    ]
    return '\n'.join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description='同步课表到 macOS Calendar（默认 dry-run）')
    parser.add_argument('--mode', choices=['dry-run', 'apply'], default='dry-run')
    parser.add_argument('--week1-date', default='2026-03-02', help='第1周周一，格式 YYYY-MM-DD')
    parser.add_argument('--week-count', type=int, default=20, help='WeekXX 周标数量（从 Week01 开始）')
    parser.add_argument('--course-name', default='自动控制原理')
    parser.add_argument('--teaching-calendar', default='教学')
    parser.add_argument('--work-calendar', default='工作')
    args = parser.parse_args()

    week1 = parse_date(args.week1_date)
    course_targets = build_course_events(week1, args.course_name)
    week_targets = build_week_events(week1, args.week_count)

    course_start = course_targets[0]['start'].replace(hour=0, minute=0)
    course_end = course_targets[-1]['end'] + dt.timedelta(days=1)
    week_start = week_targets[0]['start']
    week_end = week_targets[-1]['end'] + dt.timedelta(days=1)

    teaching_existing = list_events(args.teaching_calendar, course_start, course_end)
    work_existing = list_events(args.work_calendar, week_start, week_end)

    if args.mode == 'dry-run':
        print(
            summarize(
                teaching_existing,
                work_existing,
                course_targets,
                week_targets,
                args.course_name,
            )
        )
        return 0

    course_script = _build_apply_script(
        calendar_name=args.teaching_calendar,
        target_events=course_targets,
        start_dt=course_start,
        end_dt=course_end,
        delete_predicate=_course_delete_predicate(args.course_name),
    )
    week_script = _build_apply_script(
        calendar_name=args.work_calendar,
        target_events=week_targets,
        start_dt=week_start,
        end_dt=week_end,
        delete_predicate=_week_delete_predicate(),
    )

    course_result = _run_osascript(course_script)
    if course_result == '__CAL_NOT_FOUND__':
        raise CalendarSyncError(f'未找到日历: {args.teaching_calendar}')
    week_result = _run_osascript(week_script)
    if week_result == '__CAL_NOT_FOUND__':
        raise CalendarSyncError(f'未找到日历: {args.work_calendar}')

    print('=== Apply Summary ===')
    print(f'教学日历: {course_result}')
    print(f'工作日历: {week_result}')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except CalendarSyncError as exc:
        print(f'错误: {exc}', file=sys.stderr)
        raise SystemExit(1)
