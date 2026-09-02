/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AppRouter } from "./app/Router";
import { useSyncMigration } from "./store/useSyncMigration";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  useSyncMigration();
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}
