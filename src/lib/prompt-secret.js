import readline from 'node:readline';

export async function promptSecret(promptText = 'Enter secret: ') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    rl.question(promptText, (value) => {
      rl.close();
      process.stdout.write('\n');
      resolve(String(value || '').trim());
    });

    rl._writeToOutput = function _writeToOutput() {
      rl.output.write('*');
    };
  });
}
