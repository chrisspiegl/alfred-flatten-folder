import path from 'node:path';
import alfy from 'alfy';
import {globby} from 'globby';
import dialog from 'dialog';
import del from 'del';
import {moveFile} from 'move-file';
import PQueue from 'p-queue';

async function processFile(filePath) {
	const q = new PQueue({concurrency: 1});
	filePath = filePath.trim();
	const parentFolder = path.resolve(`${filePath}/..`);
	const filePathResolved = path.resolve(filePath);
	console.log(`Processing "${filePathResolved}"`);

	console.log('↳ filePathResolved:', filePathResolved);
	const foundFiles = await globby(filePathResolved + '/**/*');

	console.log('↳ foundFiles:', foundFiles);

	q.addAll(
		foundFiles.map(filePath => () => moveFoundFiles(filePath, parentFolder)),
	);
	await q.onIdle();

	await del(filePath, {force: true});
}

function moveFoundFiles(filePath, parentFolder) {
	filePath = filePath.trim();
	const filePathResolved = path.resolve(filePath);
	console.log('\t↳ moving:', filePathResolved);
	const fileDirectory = path.dirname(filePathResolved);
	const fileName = filePathResolved.replace(fileDirectory, '');
	const destinationFilePath = `${parentFolder}${fileName}`;
	console.log('\t↳ destinationFilePath:', destinationFilePath);
	return moveFileToDestination(filePathResolved, destinationFilePath);
}

async function moveFileToDestination(filePath, destPath, counter = 0) {
	try {
		await moveFile(filePath, (counter === 0) ? destPath : `${destPath} duplicate-filename ${counter}`, {
			overwrite: false,
		});
	} catch {
		// File already exists so put a counter on it
		await moveFileToDestination(filePath, destPath, counter + 1);
	}
}

async function processFiles(filePaths) {
	const q = new PQueue({concurrency: 1});
	return q.addAll(
		filePaths.map(element => () => processFile(element)),
	);
}

function dialogPromise(text, title, buttons, icon) {
	return new Promise(resolve => {
		buttons = `{"${buttons.join('","')}"}`; // '{"Cancel", "OK"}',
		dialog.custom(text, title, buttons, icon, (element, result) => {
			if (element === 1) {
				return resolve('Cancel');
			}

			return resolve(result.slice('button returned:'.length));
		});
	});
}

async function main() {
	const filePathsQuery = alfy.input;
	const filePaths = filePathsQuery.split('\t');

	console.log('filePaths:', filePaths);

	if (filePaths.length <= 0) {
		return dialog.info('Nothing to flatten.', 'Flatten Folder');
	}

	console.log(`Starting to flatten ${filePaths.length} Folders`);

	const buttonResult = await dialogPromise(
		'Do you really want to flatten this folder?',
		'Flatten Folder',
		['Cancel', 'OK'],
		'note',
	);

	if (buttonResult === 'Cancel') {
		return dialog.info('Canceled the flattening.', 'Flatten Folder');
	}

	await processFiles(filePaths);
	dialog.info(
		'Finished flattening Folders',
		'Flatten Folder',
	);
}

await main();
