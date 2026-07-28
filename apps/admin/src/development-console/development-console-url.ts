export function developmentConsoleUrl(baseUrl: string) {
    return `${baseUrl.replace(/\/$/, '')}/development-console/logs`;
}
