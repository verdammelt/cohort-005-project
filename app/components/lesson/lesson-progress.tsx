import { Link, useFetcher } from "react-router";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";

type NextLesson = { id: number; title: string } | null;

export function LessonProgress({
  courseSlug,
  nextLesson,
  isCompleted,
  isMarking,
  fetcher,
}: {
  courseSlug: string;
  nextLesson: NextLesson;
  isCompleted: boolean;
  isMarking: boolean;
  fetcher: ReturnType<typeof useFetcher>;
}) {
  if (isCompleted) {
    return <LessonCompleted courseSlug={courseSlug} nextLesson={nextLesson} />;
  }

  return (
    <fetcher.Form method="post" className="mb-8">
      <input type="hidden" name="intent" value="mark-complete" />
      {nextLesson ? (
        <Button disabled={isMarking}>
          {isMarking ? (
            "Completing..."
          ) : (
            <>
              Up next: {nextLesson.title}
              <ChevronRight className="ml-1 size-4" />
            </>
          )}
        </Button>
      ) : (
        <Button disabled={isMarking}>
          <CheckCircle2 className="mr-2 size-4" />
          {isMarking ? "Marking..." : "Mark as Complete"}
        </Button>
      )}
    </fetcher.Form>
  );
}

function LessonCompleted({
  courseSlug,
  nextLesson,
}: {
  courseSlug: string;
  nextLesson: NextLesson;
}) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Lesson completed</span>
      </div>
      {nextLesson && (
        <Link to={`/courses/${courseSlug}/lessons/${nextLesson.id}`}>
          <Button variant="outline" size="sm">
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}
