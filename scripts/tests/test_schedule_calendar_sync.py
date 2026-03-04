import datetime
import unittest

from schedule_calendar_sync import build_course_events, build_week_events, is_week_title


class ScheduleCalendarSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.week1_monday = datetime.date(2026, 3, 2)

    def test_course_events_should_be_33(self) -> None:
        events = build_course_events(self.week1_monday)
        self.assertEqual(len(events), 33)
        self.assertEqual(events[0]['title'], '自动控制原理L01')
        self.assertEqual(events[-1]['title'], '自动控制原理L33')

    def test_week_events_should_reach_week20(self) -> None:
        events = build_week_events(self.week1_monday, week_count=20)
        self.assertEqual(len(events), 20)
        self.assertEqual(events[0]['title'], 'Week01')
        self.assertEqual(events[-1]['title'], 'Week20')

    def test_week_title_should_accept_with_or_without_space(self) -> None:
        self.assertTrue(is_week_title('Week01'))
        self.assertTrue(is_week_title('Week 01'))
        self.assertFalse(is_week_title('Week 1'))


if __name__ == '__main__':
    unittest.main()
