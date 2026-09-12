"""Exercise the actual browser renderer + room joins against an already running server.
No fake sockets, fake renderer, or mocked physics. NOT a WebXR hardware test.
Usage: python scripts/browser-smoke.py http://localhost:8080
Dependencies: pip install playwright; python -m playwright install chromium
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080'
    output = Path('artifacts'); output.mkdir(exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--enable-webgl', '--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        try:
            boss = context.new_page(); raider = context.new_page()
            for page in (boss, raider):
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(url, wait_until='networkidle')
                page.wait_for_function('window.COLOSSUS_READY === true', timeout=20000)
            boss.locator('[data-role="boss"]').click()
            boss.locator('#name').fill('SMOKE GIANT')
            boss.locator('#create').click()
            boss.wait_for_function('window.__COLOSSUS.state !== null')
            code = boss.evaluate('window.__COLOSSUS.net.room')
            raider.locator('#name').fill('SMOKE PILOT')
            raider.locator('#room-input').fill(code)
            raider.locator('#join').click()
            raider.wait_for_function('window.__COLOSSUS.state?.players.length === 1')
            boss.wait_for_function('window.__COLOSSUS.state?.players.length === 1')
            before = raider.evaluate('window.__COLOSSUS.state.players[0].p')
            # Actual click/keyboard input, including real pointer-lock request.
            raider.locator('#resume').click()
            raider.keyboard.down('Space'); raider.keyboard.down('KeyW')
            raider.wait_for_timeout(1100)
            raider.keyboard.up('KeyW'); raider.keyboard.up('Space')
            raider.wait_for_timeout(250)
            after = raider.evaluate('window.__COLOSSUS.state.players[0].p')
            if after[1] <= before[1] + 0.3:
                raise AssertionError('Player did not ascend. Check pointer lock, input and actual physics.')
            if raider.evaluate('window.__COLOSSUS.renderer.info.render.calls') <= 0:
                raise AssertionError('Renderer did not submit a draw call.')
            # Pausing releases controls but must not stop the shared server.
            raider.keyboard.press('Escape')
            raider.screenshot(path=str(output/'desktop-smoke.png'))
            if errors:
                raise AssertionError('Browser errors: ' + '; '.join(errors))
            result = {'room': code, 'before': before, 'after': after, 'browserErrors': errors,
                      'result': 'PASS: actual desktop renderer, two room joins and ascent',
                      'notValidated': 'Quest hardware, XR stereo, visual polish, performance, long sessions'}
            (output/'browser-smoke.json').write_text(json.dumps(result, indent=2))
            print(json.dumps(result, indent=2))
            return 0
        except Exception:
            for i, page in enumerate(context.pages):
                try:
                    page.screenshot(path=str(output/f'browser-failure-{i}.png'))
                except Exception:
                    pass
            raise
        finally:
            browser.close()

if __name__ == '__main__':
    raise SystemExit(main())
