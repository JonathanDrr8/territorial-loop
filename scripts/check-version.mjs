/**
 * Pre-Commit-Wächter: stellt sicher, dass die aktuelle `package.json`-Version einen passenden
 * Abschnitt in `CHANGELOG.md` hat. Verhindert, dass eine Version live geht, die nirgends
 * dokumentiert ist (wiederkehrendes Problem). Läuft in `.husky/pre-commit` nach lint-staged.
 *
 * Logik: nur die AKTUELLE Version muss als `## [x.y.z]` im Changelog stehen — es zwingt NICHT
 * jeden Commit zu einem Bump (interne Refactors dürfen die Version lassen, ihr Eintrag existiert
 * dann schon). Wer bumpt, muss aber dieselbe Version im Changelog eintragen.
 */
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version
const changelog = readFileSync('CHANGELOG.md', 'utf8')

if (!changelog.includes(`## [${version}]`)) {
  process.stderr.write(
    `\n\x1b[31m✗ Version ${version} (package.json) fehlt in CHANGELOG.md.\x1b[0m\n` +
      `  Trage einen Abschnitt "## [${version}] – <Datum>" mit einer spielerorientierten\n` +
      `  Zeile ein (siehe vorhandene Einträge) und committe erneut.\n\n`,
  )
  process.exit(1)
}

process.stdout.write(`\x1b[32m✓\x1b[0m Version ${version} ist im Changelog dokumentiert.\n`)
