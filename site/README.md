# fetchterminal.org

The project site for [Fetch Terminal](https://github.com/fosscharlie/fetch-terminal), a lightweight, open source terminal emulator for the Linux desktop.

It's a plain static page: no build step, no framework, no CDN. Everything it loads (fonts, xterm.js, the icon set) is vendored into this repo, so the page never makes an outbound request beyond serving itself.

## Structure

```
index.html      the whole page
styles.css      all styling
demo.js         drives the scripted terminal demo (xterm.js, no real shell behind it)
icons.js        the same inline-SVG icon set as the app itself
vendor/         xterm.js and its stylesheet, vendored from the app's own dependency
fonts/          Geist Sans and Geist Mono, vendored from the app's own bundled fonts
favicon.png     the app's own icon
CNAME           GitHub Pages custom domain
```

## Developing

Any static file server works:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying

GitHub Pages, configured to serve from this repository's default branch. The `CNAME` file points it at `fetchterminal.org`.

## License

MIT, see [LICENSE](LICENSE). xterm.js (vendored in `vendor/`) is MIT licensed, see `vendor/xterm-LICENSE.txt`. Geist (vendored in `fonts/`) is SIL Open Font License 1.1, see `fonts/GEIST-LICENSE.txt`.
