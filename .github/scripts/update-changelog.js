/**
 * Updates CHANGELOG.md with release notes from GitHub
 * Used by the publish workflow
 */

const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context, core }) => {
  try {
    // Get the release notes from GitHub
    const releaseNotes = await github.rest.repos.generateReleaseNotes({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag_name: process.env.TAG_NAME
    });

    // Read current changelog
    const changelogPath = 'CHANGELOG.md';
    let changelog = '';
    try {
      changelog = fs.readFileSync(changelogPath, 'utf8');
    } catch (error) {
      console.log('CHANGELOG.md not found, creating new one');
      changelog = '# Changelog\n\n';
    }

    // Format the new entry
    const version = process.env.VERSION;
    const today = new Date().toISOString().split('T')[0];
    const newEntry = `## [${version}] - ${today}\n\n${releaseNotes.data.body}\n\n`;

    // Insert the new entry after the first line (# Changelog)
    const lines = changelog.split('\n');
    const headerIndex = lines.findIndex(line => line.startsWith('# Changelog'));

    if (headerIndex !== -1) {
      // Insert after the header and any existing blank lines
      let insertIndex = headerIndex + 1;
      while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
        insertIndex++;
      }
      lines.splice(insertIndex, 0, newEntry);
    } else {
      // If no header found, prepend to the file
      lines.unshift('# Changelog', '', newEntry.trim());
    }

    // Write the updated changelog
    const updatedChangelog = lines.join('\n');
    fs.writeFileSync(changelogPath, updatedChangelog);

    console.log(`✅ Updated CHANGELOG.md with release notes for ${version}`);

    // Set output for debugging
    core.setOutput('changelog-updated', 'true');
    core.setOutput('version', version);

  } catch (error) {
    console.error('❌ Error updating changelog:', error);
    core.setFailed(`Failed to update changelog: ${error.message}`);
  }
};
