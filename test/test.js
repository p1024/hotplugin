const Hotplugin = require('../index.js');
const assert = require('assert');
const handyfs = require('handyfs');
const path = require('path');

const main = async ()=> {
	// init
	let hotplugging = new Hotplugin({autoDirList: ['./module/'], exts: ['js', 'json', '', 'xml']});
	await hotplugging.cacheAll();

	// dynamic create an module
	let moduleName = 'module4';
	let modulePlugin = {
		content: `module.exports = ()=>{return 'this is ${moduleName}.js';}`,
		uri: `./module/${moduleName}.js`
	};
	await handyfs.writeFileSimple(modulePlugin.uri, modulePlugin.content);
	// dynamic import
	let module = await hotplugging.in(moduleName);
	assert.ok(module() === `this is ${moduleName}.js`, `it should successfully require the module4 and exec the function, ${module} received`);
	// delete the module
	await handyfs.unlinkAsync(modulePlugin.uri);
	// drop the plugin
	hotplugging.out(moduleName);


	// dynamic create an JSON
	moduleName = 'json';
	let JSONPlugin = {
		content: `{"name": "${moduleName}", "version": 1}`,
		uri: `./module/${moduleName}.json`
	};
	await handyfs.writeFileSimple(JSONPlugin.uri, JSONPlugin.content);
	// dynamic import
	let json = await hotplugging.in(moduleName);
	assert.ok(json.name === moduleName, `require should received an object, ${json} received`);
	// delete the module
	await handyfs.unlinkAsync(JSONPlugin.uri);
	// drop the plugin
	hotplugging.out(moduleName);


	// require an module that not know
	moduleName = 'module3';
	module = await hotplugging.in(moduleName);
	assert.ok(module === path.resolve('./module/', 'module3.xml'), `require a module without handler should return module\'s path, ${module} received`);
}

main();
