import { describe, it, expect } from "vitest";
import { lessonSections, type LessonSectionsInput } from "../index";

const enrolledStudent: LessonSectionsInput = {
  hasVideo: true,
  hasContent: true,
  hasQuiz: true,
  signedIn: true,
  enrolled: true,
};

describe("lessonSections", () => {
  it("puts the note after the lesson, right above the discussion", () => {
    expect(lessonSections(enrolledStudent)).toEqual([
      "video",
      "content",
      "quiz",
      "progress",
      "note",
      "discussion",
    ]);
  });

  it("keeps the note beside the discussion when there is no quiz", () => {
    const sections = lessonSections({ ...enrolledStudent, hasQuiz: false });
    expect(sections.slice(-2)).toEqual(["note", "discussion"]);
    expect(sections).not.toContain("quiz");
  });

  it("shows a signed-in visitor who is not enrolled the note but no quiz or progress", () => {
    expect(lessonSections({ ...enrolledStudent, enrolled: false })).toEqual([
      "video",
      "content",
      "note",
      "discussion",
    ]);
  });

  it("shows a signed-out visitor no note, quiz or progress", () => {
    expect(
      lessonSections({ ...enrolledStudent, signedIn: false, enrolled: true })
    ).toEqual(["video", "content", "discussion"]);
  });

  it("shows the empty state only when there is neither video nor content", () => {
    expect(
      lessonSections({ ...enrolledStudent, hasVideo: false, hasContent: false })
    ).toEqual(["empty", "quiz", "progress", "note", "discussion"]);
    expect(
      lessonSections({ ...enrolledStudent, hasVideo: false })
    ).not.toContain("empty");
    expect(lessonSections({ ...enrolledStudent, hasContent: false })).toEqual([
      "video",
      "quiz",
      "progress",
      "note",
      "discussion",
    ]);
  });
});
