import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom"
import { MainLayout } from "../components/layout/MainLayout"
import { DashboardPage } from "../modules/dashboard/DashboardPage"
import { LibraryPage } from "../modules/library/LibraryPage"
import { BookDetailPage } from "../modules/library/BookDetailPage"
import { LoginPage } from "../modules/auth/LoginPage"
import { NotesPage } from "../modules/notes/NotesPage"
import { NoteDetailPage } from "../modules/notes/NoteDetailPage"
import { CurriculumPage } from "../modules/curriculum/CurriculumPage"
import { PathDetailPage } from "../modules/curriculum/PathDetailPage"
import { ProjectsPage } from "../modules/projects/ProjectsPage"
import { ProjectDetailPage } from "../modules/projects/ProjectDetailPage"
import { WritingPage } from "../modules/writing/WritingPage"
import { WritingDetailPage } from "../modules/writing/WritingDetailPage"
import { KnowledgeGraphPage } from "../modules/graph/KnowledgeGraphPage"
import { NodeDetailPage } from "../modules/graph/NodeDetailPage"
import { ReviewPage } from "../modules/review/ReviewPage"
import { DeckDetailPage } from "../modules/review/DeckDetailPage"
import { ReviewSessionPage } from "../modules/review/ReviewSessionPage"
import { SettingsPage } from "../modules/settings/SettingsPage"
import { AnalyticsPage } from "../modules/analytics/AnalyticsPage"
import { ConceptsPage } from "../modules/concepts/ConceptsPage"
import { useAuthStore } from "../store/authStore"

function ProtectedRoute() {
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding)

  if (!hasCompletedOnboarding) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: "curriculum",
            element: <CurriculumPage />,
          },
          {
            path: "curriculum/:id",
            element: <PathDetailPage />,
          },
          {
            path: "library",
            element: <LibraryPage />,
          },
          {
            path: "library/:id",
            element: <BookDetailPage />,
          },
          {
            path: "notes",
            element: <NotesPage />,
          },
          {
            path: "notes/:id",
            element: <NoteDetailPage />,
          },
          {
            path: "projects",
            element: <ProjectsPage />,
          },
          {
            path: "projects/:id",
            element: <ProjectDetailPage />,
          },
          {
            path: "writing",
            element: <WritingPage />,
          },
          {
            path: "writing/:id",
            element: <WritingDetailPage />,
          },
          {
            path: "graph",
            element: <KnowledgeGraphPage />,
          },
          {
            path: "graph/:id",
            element: <NodeDetailPage />,
          },
          {
            path: "review",
            element: <ReviewPage />,
          },
          {
            path: "review/:id",
            element: <DeckDetailPage />,
          },
          {
            path: "review/:id/session",
            element: <ReviewSessionPage />,
          },
          {
            path: "analytics",
            element: <AnalyticsPage />,
          },
          {
            path: "settings",
            element: <SettingsPage />,
          },
          {
            path: "concepts",
            element: <ConceptsPage />,
          }
        ]
      }
    ]
  }
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
