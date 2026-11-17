import {lazy, Suspense} from 'react';
import { Outlet } from "@tryghost/admin-x-framework";
import { useCurrentUser } from "@tryghost/admin-x-framework/api/current-user";
import { EmberProvider, EmberFallback, EmberRoot } from "./ember-bridge";
import { AdminLayout } from "./layout/admin-layout";
import { useEmberAuthSync, useEmberDataSync } from "./ember-bridge";

const DevelopmentConsole = import.meta.env.DEV
    ? lazy(() => import('./development-console/development-console').then(module => ({default: module.DevelopmentConsole})))
    : null;

function App() {
    const { data: currentUser } = useCurrentUser();
    useEmberAuthSync();
    useEmberDataSync();

    return (
        <EmberProvider>
            {currentUser ?
                <>
                    <AdminLayout>
                        <Outlet />
                        <EmberRoot />
                    </AdminLayout>
                </>
                :
                <>
                    <EmberFallback />
                    <EmberRoot />
                </>
            }
            {DevelopmentConsole && (
                <Suspense>
                    <DevelopmentConsole />
                </Suspense>
            )}
        </EmberProvider>
    );
}

export default App;
