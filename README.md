# www

The hub for sites under the `damato.design` domain, built with [Astro](https://astro.build).

## Development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to _site/
npm run preview
```

## Sites

Sites are managed as an Astro content collection: [`src/content/sites.yaml`](src/content/sites.yaml) is a plain list of subdomains (`blog` → `https://blog.damato.design`), and cards appear in the same order as the list. The collection is defined in [`src/content.config.ts`](src/content.config.ts).

At build time each homepage is fetched and its Open Graph tags (`og:title`, `og:description`, `og:image`, falling back to Twitter tags, `<title>`, and `<meta name="description">`) fill in the card. If a site can't be reached or its `og:image` doesn't load, the card falls back to the hostname and a placeholder image, and the build logs an `[og]` warning.

Because OG data is captured at build time, rebuild the hub to pick up changes made on the other sites.
