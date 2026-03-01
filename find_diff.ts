import * as fs from 'fs';

const file1 = fs.readFileSync('drift_state_1.json', 'utf8');
const file2 = fs.readFileSync('drift_state_2.json', 'utf8');

if (file1 === file2) {
    console.log("Files are identical");
} else {
    let i = 0;
    while (i < file1.length && i < file2.length && file1[i] === file2[i]) {
        i++;
    }
    console.log(`Difference at index ${i}`);
    console.log(`File 1: ...${file1.substring(i - 50, i + 50)}...`);
    console.log(`File 2: ...${file2.substring(i - 50, i + 50)}...`);
}
