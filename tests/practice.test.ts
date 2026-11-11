import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  acceptPractice,
  canComplete,
  leagueBand,
  lessonState,
  normalizePractice,
  practiceXp,
  presentLesson,
  presentToday,
  todayQuest,
  weekBounds,
  lessonById,
  LESSONS,
  hiddenDoor,
  visibleLessons,
  rotateDoor,
  NEW_SKILL_DAYS,
} from "../src/lib/practice"
import { todayTwist } from "../src/lib/practice-twist"

const quiet = { completions: [] }

describe("practice", () => {
  it("opens the first skill on each branch and keeps the next one locked", async () => {
    assert.equal(lessonState(quiet, "sleep-wake"), "open")
    assert.equal(lessonState(quiet, "move-walk"), "open")
    assert.equal(lessonState(quiet, "sleep-dim"), "locked")
    assert.deepEqual(visibleLessons(quiet, "sleep").map((lesson) => lesson.id), ["sleep-wake"])
    assert.equal(hiddenDoor(quiet, "sleep"), null)
    assert.equal(presentLesson("en", lessonById("sleep-wake")!).title, "Keep tomorrow’s wake time close")
    assert.equal(todayQuest(quiet, "2026-11-04")?.lesson.id, "sleep-wake")
    for (const lesson of LESSONS) {
      for (const locale of ["en", "de"] as const) {
        const steps = presentLesson(locale, lesson).action.split(". ").filter(Boolean)
        assert.ok(steps.length >= 2, `${locale} ${lesson.id}`)
      }
    }
  })

  it("puts today’s number on the open door", async () => {
    const lesson = lessonById("sleep-wake")!
    const base = presentLesson("en", lesson)
    const shown = presentToday("en", lesson, "2026-11-04")
    const twist = todayTwist("en", "sleep", "2026-11-04", lesson.id)
    assert.equal(shown.action, `${base.action} ${twist.action}`)
    assert.equal(shown.doneLine, `${base.doneLine} ${twist.done}`)
    assert.notEqual(shown.action, presentToday("en", lesson, "2026-11-05").action)
    const german = presentToday("de", lesson, "2026-11-04")
    assert.ok(german.action.includes(todayTwist("de", "sleep", "2026-11-04", lesson.id).action))
  })

  it("records one skill per branch for the device’s today and unlocks the next on that branch after a week", async () => {
    const now = new Date(Date.UTC(2026, 10, 4, 12, 0, 0))
    const saved = acceptPractice({
      stored: quiet,
      incoming: { completions: [{ id: "sleep-wake", date: "2026-11-04" }] },
      serverNow: now,
      offset: 0,
    })
    assert.equal(saved.completions.length, 1)
    assert.equal(lessonState(saved, "sleep-dim"), "locked")
    assert.equal(hiddenDoor(saved, "sleep", "2026-11-04"), "week")
    assert.equal(canComplete(saved, "sleep-dim", "2026-11-04"), false)
    assert.equal(canComplete(saved, "move-walk", "2026-11-04"), true)
    assert.equal(NEW_SKILL_DAYS, 7)
    assert.equal(lessonState(saved, "sleep-dim", "2026-11-10"), "locked")
    assert.equal(lessonState(saved, "sleep-dim", "2026-11-11"), "open")
    assert.equal(canComplete(saved, "sleep-dim", "2026-11-11"), true)
    assert.equal(todayQuest(saved, "2026-11-10")?.lesson.id, "sleep-wake")
    assert.equal(todayQuest(saved, "2026-11-11")?.lesson.id, "sleep-dim")
    const again = acceptPractice({
      stored: saved,
      incoming: { completions: [...saved.completions, { id: "move-walk", date: "2026-11-04" }] },
      serverNow: now,
      offset: 0,
    })
    assert.equal(again.completions.length, 2)
    assert.equal(todayQuest(saved, "2026-11-04")?.lesson.id, "move-walk")
    assert.equal(todayQuest(again, "2026-11-04")?.lesson.id, "food-water")
    const four = acceptPractice({
      stored: quiet,
      incoming: {
        completions: [
          { id: "sleep-wake", date: "2026-11-04" },
          { id: "move-walk", date: "2026-11-04" },
          { id: "food-water", date: "2026-11-04" },
          { id: "load-name", date: "2026-11-04" },
          { id: "sleep-dim", date: "2026-11-04" },
        ],
      },
      serverNow: now,
      offset: 0,
    })
    assert.equal(four.completions.length, 4)
    assert.equal(canComplete(four, "sleep-dim", "2026-11-04"), false)
    assert.equal(todayQuest(four, "2026-11-04")?.status, "done")
  })

  it("ignores a backfilled skill and a skill the branch has not opened", async () => {
    const now = new Date(Date.UTC(2026, 10, 4, 12, 0, 0))
    const saved = acceptPractice({
      stored: quiet,
      incoming: { completions: [{ id: "sleep-dim", date: "2026-11-04" }, { id: "sleep-wake", date: "2026-11-01" }] },
      serverNow: now,
      offset: 0,
    })
    assert.deepEqual(saved.completions, [])
    assert.equal(practiceXp(normalizePractice({ completions: [{ id: "nope", date: "2026-11-04" }] })), 0)
  })

  it("grows each branch to a month of skills and keeps German two-step copy", async () => {
    assert.equal(LESSONS.length, 28)
    for (const track of ["sleep", "movement", "nutrition", "stress"] as const) {
      const branch = LESSONS.filter((lesson) => lesson.track === track)
      assert.equal(branch.length, 7)
      assert.deepEqual(branch.map((lesson) => lesson.level), [1, 2, 3, 4, 5, 6, 7])
    }
    for (const lesson of LESSONS) {
      const german = presentLesson("de", lesson)
      assert.notEqual(german.title, lesson.title, lesson.id)
      for (const locale of ["en", "de"] as const) {
        const steps = presentLesson(locale, lesson).action.split(". ").filter(Boolean)
        assert.ok(steps.length >= 2, `${locale} ${lesson.id}`)
      }
    }
  })

  it("counts this week’s practice points on this file only", async () => {
    const log = normalizePractice({
      completions: [
        { id: "sleep-wake", date: "2026-11-02" },
        { id: "move-walk", date: "2026-11-03" },
        { id: "food-water", date: "2026-10-20" },
      ],
    })
    const week = weekBounds("2026-11-04")
    assert.equal(week.from, "2026-11-02")
    assert.equal(week.through, "2026-11-08")
    assert.equal(practiceXp(log, week.from, week.through), 20)
    assert.equal(practiceXp(log), 30)
    assert.equal(leagueBand(20), "sprout")
    assert.equal(leagueBand(0), "seed")
    assert.equal(leagueBand(40), "grove")
    const returned = normalizePractice({
      completions: [
        { id: "sleep-wake", date: "2026-10-20" },
        { id: "sleep-wake", date: "2026-11-03" },
      ],
    })
    assert.equal(practiceXp(returned), 10)
    assert.equal(practiceXp(returned, week.from, week.through), 10)
  })

  it("rotates a finished branch and keeps completed lessons visible", async () => {
    const sleepDone = {
      completions: [
        { id: "sleep-wake", date: "2026-11-01" },
        { id: "sleep-dim", date: "2026-11-02" },
        { id: "sleep-nap", date: "2026-11-03" },
        { id: "sleep-caffeine", date: "2026-11-04" },
        { id: "sleep-cool", date: "2026-11-05" },
        { id: "sleep-chair", date: "2026-11-06" },
        { id: "sleep-weekend", date: "2026-11-07" },
      ],
    }
    assert.equal(rotateDoor(sleepDone, "sleep")?.id, "sleep-wake")
    assert.equal(todayQuest(sleepDone, "2026-11-08")?.lesson.id, "sleep-wake")
    assert.equal(canComplete(sleepDone, "sleep-wake", "2026-11-08"), true)
    assert.equal(canComplete(sleepDone, "sleep-dim", "2026-11-08"), false)
    assert.equal(hiddenDoor(sleepDone, "sleep"), "rotation")
    assert.equal(lessonState(sleepDone, "sleep-dim"), "done")
    assert.deepEqual(
      visibleLessons(sleepDone, "sleep").map((lesson) => lesson.id),
      ["sleep-wake", "sleep-dim", "sleep-nap", "sleep-caffeine", "sleep-cool", "sleep-chair", "sleep-weekend"],
    )
  })
})
