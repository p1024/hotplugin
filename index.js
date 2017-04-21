/**
 * @date 		2017-04-10 22:19:43
 * @author 		Tommy
 * @description dynamically load or require module and resources when app is running.
 */
const handyfs = require('handyfs');
const path = require('path');
const SingleTon = require('singleton');


const utils = {
	/**
	 * judge the type of the target
	 * @param  {all}     target object to detect
	 * @param  {string}  type   target's type
	 * @return {Boolean}        true represents equal
	 */
	is(target, type) {
		return Object.prototype.toString.call(target).slice(8, -1).toLowerCase() === type.toLowerCase();
	},
	uniqueConcat(...args) {
		return Array.from(new Set(Array.prototype.concat.apply([], args)));
	},
	/**
	 * create defalt handlers
	 * @return {Map} handlers for the ext
	 */
	createHandlerMap() {
		function loadModule(mpath) {
			return require(mpath);
		}


		async function loadJSON(mpath) {
			let content = await handyfs.readFileAsync(mpath);
			return JSON.parse(content);
		}

		function final(mpath) {
			return mpath;
		}
		/* '' stands for directory or files without ext */
		let handlerMap = new Map([
			['js', loadModule],
			['', loadModule],
			['json', loadJSON],
			['final', final]
		]);

		return handlerMap;
	}
}


class Hotplugin extends SingleTon{
	

	/**
	 * init part of the class
	 * @param  {object} options {autoDir, exts, typeMap}
	 */
	constructor(options) {
		super();
		if(!this.created()) {
			this.autoDirList = [];
			this.exts = [];
			this.moduleList = new Map();
			this.typeMap = new Map();

			// add formats support by default 
			options.exts = utils.uniqueConcat(['js', 'json', ''], options.exts);

			let typeMap = utils.createHandlerMap();
			if (options.typeMap) {
				if(utils.is(options.typeMap, 'map')) {
					for(let type of typeMap) {
						options.typeMap.set(type, typeMap.get(type));
					}
				} else {
					throw Error(`typeMap should be Map, ${typeof typeMap} received`);
				}
			} else {
				options.typeMap = typeMap;
			}
			
			
			this.config(options);
		}
	}

	/**
	 * config options
	 * @param  {object} options {autoDir, exts, typeMap}
	 * ------------------------------------------------------------
	 * @param  {string|array} autoDir auto load module directory
	 * @param  {Array}        exts    exts require's auto load
	 * @param  {Map}          typeMap functions to handle the auto-load module
	 */
	config(options) {
		let valid = new Set(['typeMap', 'exts', 'autoDirList']);
		for(let name in options) {
			if(valid.has(name)) {
				this[name] = options[name];
			}
		}
	}


	/**
	 * cache all the type/uri info of the modules
	 */
	async cacheAll() {
		let autoDirList = this.autoDirList;

		for(let j=0, ln=autoDirList.length; j<ln; j++) {
			let autoDir = autoDirList[j];
			let modulePathList = await handyfs.readdirAsync(autoDir);
			let moduleList = this.moduleList;

			for(let i=0, ln=modulePathList.length; i<ln; i++) {

				let mpath = path.resolve(path.join(autoDir, modulePathList[i]));
				let type, moduleName;
				// is dir or file
				if(await handyfs.isdir(mpath)) {
					type = '';
					moduleName = path.basename(mpath);
				} else {
					type = path.extname(mpath).slice(1);
					moduleName = path.basename(mpath).slice(0, -(type.length+1));
				}

				moduleList.set(moduleName, {
					module: null,
					path: mpath,
					type: type
				});

			}
		}
	}


	/**
	 * plug in the require module (plug in)
	 * @param  {string} moduleName module name
	 * @return {all}                the needed module
	 */
	async in(moduleName) {
		let {autoDirList, typeMap, moduleList, exts} = this;
		let moduleExits = moduleList.has(moduleName);

		if(!moduleExits) {
			
			for(let i=0, ln=autoDirList.length; i<ln; i++) {
				let autoDir = autoDirList[i];
				for(let j=0; j<exts.length; j++) {
					let ext = exts[j];
					let mpath = path.resolve(path.join(autoDir, moduleName));
					mpath += ext === ''?'':'.'+ext;
					try {
						let stat = await handyfs.lstatAsync(mpath);
					} catch(e) {
						continue;
					}

					moduleList.set(moduleName, {
						module: null,
						path: mpath,
						type: ext
					});
					moduleExits = true;
					break;
				}
			}
		}

		if(!moduleExits) {
			return null;
		} else {
			let module = moduleList.get(moduleName);

			// load when needed
			if(module.module===null && typeMap.has(module.type)) {
				module.module = await typeMap.get(module.type)(module.path);
			} else {
				module.module = await typeMap.get('final')(module.path);;
			}

			return module.module;
		}

	}


	/**
	 * release the cache module (plug out)
	 * @param  {string} moduleName module name
	 */
	out(moduleName) {
		let moduleList = this.moduleList;
		if(moduleName) {

			if(moduleList.has(moduleName)) {
				// only one
				moduleList.get(moduleName).module = null;
				return true;
			} else {
				// not exist
				return false;
			}
		} else {
			// free all
			for(let module of moduleList.values()) {
				module.module = null;
			}
		}
	}
}

module.exports = Hotplugin;