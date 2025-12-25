import fs from 'fs/promises';
import path from 'path';

const logsDir = path.resolve(process.cwd(), '..', '.logs');

const truncateLogs = async () => {
  try {
    const entries = await fs.readdir(logsDir, { withFileTypes: true });
    const tasks = entries
      .filter((entry) => entry.isFile())
      .map((entry) => fs.writeFile(path.join(logsDir, entry.name), ''));
    await Promise.all(tasks);
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    console.warn('Failed to clear logs:', error);
  }
};

await truncateLogs();
