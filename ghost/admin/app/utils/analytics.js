// Wrapper function for Plausible event

/**
 * Asynchronously waits for PostHog to be loaded,
 * then executes the provided callback with the PostHog object as an argument
 * 
 * Posthog is only loaded if the clientExtensions script is enabled in config,
 * and window.posthog.__loaded is set to true
 * @param {object} config
 * @param {function} callback
 * @returns {void}
 */
async function withPosthog(config, callback) {
    // If the clientExtensions.script config is not set, we can't use PostHog
    if (!config.clientExtensions?.script) {
        return;
    }
    let iterations = 0;
    // Check for window.posthog to be fully loaded every 100ms, up to 2 seconds
    const interval = setInterval(function waitForPosthog() {
        iterations += 1;
        if (window.posthog?.__loaded) {
            clearInterval(interval);
            console.log('Posthog loaded, running callback');
            callback(window.posthog);
        } else if (iterations > 20) {
            clearInterval(interval);
        }
    }, 100);
}

/**
 * Hashes a user's email address so we can use it as a distinct_id in PostHog without storing the email address itself
 * 
 * 
 * @param {string} email an email address
 * @returns {(string|null)} a sha256 hash of the email address to use as distinct_id in PostHog — null if hashing fails
 */
async function hashEmail(email) {
    try {
        const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
        const hashArray = Array.from(new Uint8Array(digest));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        // Double-check that the hash is a valid sha256 hex string before returning it, else return null
        return hash.length === 64 ? hash : null;
    } catch (e) {
        // Modern browsers all support window.crypto, but we need to check for it to avoid errors on really old browsers
        // If any errors occur when hashing email, return null
        return null;
    }
}

/**
 * Sends a tracking event to Plausible, if installed.
 * 
 * By default, Plausible is not installed, in which case this function no-ops.
 * 
 * @param {string} eventName A string name for the event being tracked
 * @param {Object} [props={}] An optional object of properties to include with the event
 */
export function trackEvent(eventName, props = {}) {
    window.plausible = window.plausible || function () {
        (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    window.plausible(eventName, {props: props});
}

/**
 * Calls posthog.identify() with a hashed email address as the distinct_id
 * This will only run if window.posthog exists, so will not run in self-hosted instances
 * This is an async function because it waits for PostHog to exist, and hashing the email address is async
 * But generally you should not `await` this function, as it's not critical to the user experience and
 * it's not worth blocking the app for it
 * 
 * @param {Object} user A user to identify in PostHog
 * @returns {void}
 */
export async function identifyUser(user, config) {
    withPosthog(config, async function (posthog) {
        if (user && user.get('email')) {
            const email = user.get('email');
            const hashedEmail = await hashEmail(email);
            const distinctId = posthog.get_distinct_id();
            // Only continue if hashing was successful, and the user hasn't already been identified
            if (hashedEmail && hashedEmail !== distinctId) {
                const props = {};
                // Add the user's id
                if (user.get('id')) {
                    props.id = user.get('id');
                }
                // Add the user's role
                if (user.get('role').name) {
                    props.role = user.get('role').name.toLowerCase();
                }
                // Add the user's created_at date
                if (user.get('createdAtUTC')) {
                    props.created_at = user.get('createdAtUTC').toISOString();
                }
                console.log('Identifying user in PostHog with hashed email', hashedEmail, props);
                posthog.identify(hashedEmail, props);
            }
        }
    });   
}

/**
 * Calls posthog.reset() to clear the current user's distinct_id and all associated properties
 * To be called when a user logs out
 * 
 * @returns {void}
 */
export async function resetUser(config) {
    withPosthog(config, function (posthog) {
        posthog.reset();
    });
}