import {createRoot} from 'react-dom/client';
import adminStyles from '@/index.css?inline';
import {installApiRequestTracker} from './api-request-tracker';
import {DevelopmentConsole} from './development-console';

const ROOT_ID = 'ghost-development-console-root';

function mountDevelopmentConsole() {
    if (!document.body || document.getElementById(ROOT_ID)) {
        return;
    }

    installApiRequestTracker();

    const host = document.createElement('ghost-development-console');
    host.id = ROOT_ID;
    host.style.all = 'initial';
    host.style.position = 'relative';
    host.style.zIndex = '2147483647';

    const shadow = host.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    const mount = document.createElement('div');

    style.textContent = adminStyles.replaceAll(':root', ':host');
    mount.className = 'shade';
    shadow.append(style, mount);
    document.body.appendChild(host);

    createRoot(mount).render(<DevelopmentConsole />);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDevelopmentConsole, {once: true});
} else {
    mountDevelopmentConsole();
}
