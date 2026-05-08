<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { env } from "$env/dynamic/public";
    import { getSettings } from "$lib/db/settings";
    import "../app.css";

    let { children } = $props();

    let isAbout = $derived($page.url.pathname === '/about');

    const navItems = [
        { href: "/", label: "Capture", icon: "📷" },
        { href: "/history", label: "History", icon: "📋" },
        { href: "/settings", label: "Settings", icon: "⚙️" },
        { href: "/about", label: "About", icon: "ℹ️" },
    ];

    onMount(async () => {
        const settings = await getSettings();
        const hasZenMoneyConnection =
            Boolean(settings.zenmoneyToken) ||
            Boolean(settings.zenmoneyAccessToken);

        if (
            (!settings.claudeApiKey || !hasZenMoneyConnection) &&
            !$page.url.pathname.startsWith("/settings") &&
            !$page.url.pathname.startsWith("/oauth/callback") &&
            !$page.url.pathname.startsWith("/about")
        ) {
            goto("/settings");
        }
    });
</script>

<div class="app" class:about={isAbout}>
    <main class="content">
        {@render children()}
    </main>
    <nav class="bottom-nav">
        {#each navItems as item}
            <a
                href={item.href}
                class="nav-item"
                class:active={$page.url.pathname === item.href}
                aria-label={item.label}
            >
                <span class="icon">{item.icon}</span>
                <span class="label">{item.label}</span>
            </a>
        {/each}
    </nav>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        height: 100dvh;
        max-width: 480px;
        margin: 0 auto;
    }
    @media (min-width: 640px) {
        .app.about {
            max-width: 100%;
            height: auto;
        }
        .app.about .content {
            overflow-y: visible;
        }
        .app.about .bottom-nav {
            display: none;
        }
    }
    .content {
        flex: 1;
        overflow-y: auto;
    }
    .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        max-width: 480px;
        height: var(--nav-height);
        display: flex;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
        z-index: 100;
    }
    .nav-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        text-decoration: none;
        color: var(--color-text-muted);
        font-size: 11px;
        transition: color 0.15s;
    }
    .nav-item.active {
        color: var(--color-primary);
    }
    .icon {
        font-size: 22px;
        line-height: 1;
    }
</style>
