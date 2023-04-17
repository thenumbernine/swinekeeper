let grid;

function posmod(x,y) {
	return ((x % y) + y) % y;
}

const ids = {};
['newgame', 'board', 'width', 'height', 'percentMines', 'minesleft', 'cellsize', 'nbhddiv', 'qgmode', 'hints', 'torus', 'percentUncovered', 'timeTaken', 'help', 'helpdiv'].forEach(f => {
	ids[f] = document.getElementById(f);
});
window.ids = ids;

function changedConfig(e) {
	if (!grid.clicked) newgame();
}

ids.qgmode.addEventListener('change', changedConfig);
ids.torus.addEventListener('change', changedConfig);

ids.help.addEventListener('change', e => {
	if (ids.helpdiv.style.display == 'none') {
		ids.helpdiv.style.display = 'block';
	} else {
		ids.helpdiv.style.display = 'none';
	}
});

function Neighborhood(n, symbol, desc, checked) {
	this.n = n;
	this.symbol = symbol || '';
	// default neighborhoods (not the QG ones)
	if (desc) {
		this.desc = desc;
		this.input = document.createElement('input');
		this.input.type = 'checkbox';
		this.input.checked = checked;
		this.input.addEventListener('change', changedConfig);
		ids.nbhddiv.appendChild(document.createTextNode('('+this.desc+') '+this.symbol));
		ids.nbhddiv.appendChild(this.input);
		ids.nbhddiv.appendChild(document.createElement('br'));
	}
}
Neighborhood.prototype = {
	iter : function(f) {
		this.n.forEach(dxy => {
			f.apply(null, dxy);
		});
	},
	gridPtIter : function(ij,f) {
		const [i,j] = ij;
		this.iter((dx,dy) => {
			let x = i+dx;
			let y = j+dy;
			if (grid.torus) {
				x = posmod(x, grid.width);
				y = posmod(y, grid.height);
			}
			if (x >= 0 &&
				x < grid.width &&
				y >= 0 &&
				y < grid.height
			) {
				f(grid.cells[x][y]);
			}
		});
	},
};
const nbhds = [
	new Neighborhood([
		[1,0],[-1,0],[0,1],[0,-1],
		[1,1],[1,-1],[-1,1],[-1,-1]
	], 'o', '3x3', true),
	new Neighborhood([[1,0],[-1,0],[0,1],[0,-1]], '+', 'cardinal', true),
	new Neighborhood([[1,1],[1,-1],[-1,1],[-1,-1]], 'x', 'diagonal', true),

	new Neighborhood([[-1,1]], 'ul', 'up left', false),
	new Neighborhood([[1,1]], 'ur', 'up right', false),
	new Neighborhood([[-1,-1]], 'dl', 'down left', false),
	new Neighborhood([[1,-1]], 'dr', 'down right', false),

	new Neighborhood([[0,1]], 'u', 'up', false),
	new Neighborhood([[0,-1]], 'd', 'down', false),
	new Neighborhood([[-1,0]], 'l', 'left', false),
	new Neighborhood([[1,0]], 'r', 'right', false),

	// TODO how about all possible combinations of L-inf=1, 2, etc ?
	new Neighborhood(
		(()=>{
			const n = [];
			for (let i = 1; i <= 2; ++i) {
				n.push([i,i]);
				n.push([i,-i]);
				n.push([-i,i]);
				n.push([-i,-i]);
			}
			return n;
		})(),
		'X', 'diagonal-2', true
	),
	new Neighborhood(
		(()=>{
			const n = [];
			for (let i = 1; i <= 2; ++i) {
				n.push([0,i]);
				n.push([0,-i]);
				n.push([i,0]);
				n.push([-i,0]);
			}
			return n;
		})(),
		'P', 'cardinal-2', true
	),
	new Neighborhood(
		(()=>{
			const n = [];
			for (let dx = -2; dx <= 2; ++dx) {
				for (let dy = -2; dy <= 2; ++dy) {
					if (!(dx == 0 && dy == 0)) {
						n.push([dx,dy]);
					}
				}
			}
			return n;
		})(),
		'O', '5x5', true
	),
];
window.nbhds = nbhds;

function createRandomNeighborhood(pos) {
	const n = [];
	//size?
	//hmm, nbhd size ... 
	// 1, 2 = too small
	// 4 = small but good
	// 8 = ideal
	// 24 = big but good
	const size = parseInt(Math.random() * 20) + 1;

	for (let i = 0; i < size; ++i) {
		for (let tries=0; tries<100; ++tries) {
			// another way to do this: put all cells in an array, assign weight according to their inv dist, then pick by weight
			const r = 1/(1 - Math.random() * (1 - 1/Math.max(grid.width, grid.height)));
			const th = Math.random() * 2 * Math.PI;
			const dx = Math.floor(r * Math.cos(th));
			const dy = Math.floor(r * Math.sin(th));
			if (!(dx == 0 && dy == 0)) {
				let i = pos[0]+dx;
				let j = pos[1]+dy;
				if (grid.torus) {
					i = posmod(i, grid.width);
					j = posmod(j, grid.height);
				}
				if (i >= 0 && i < grid.width && j >= 0 && j < grid.height) {
					let found = false;
					n.forEach(dxy => {
						if (dxy[0] == dx && dxy[1] == dy) {
							found = true;
							return true;
						}
					});
					if (!found) {
						n.push([dx,dy]);
					}
					break;
				}
			}
		}
	}
	return new Neighborhood(n);
}

function pickRandom(ar) {
	return ar[parseInt(Math.random() * ar.length)];
}

function Grid(args) {
	grid = this;	//assign here so ctor calls can access 'grid'
window.grid = grid;
	const thiz = this;
	this.clicked = false;
	this.nbhdOverlays = [];
	
	[this.width, this.height] = args.size;

	ids.board.innerHTML = '';

	this.torus = ids.torus.checked;

	this.cells = [];
	for (let i = 0; i < this.width; ++i) {
		this.cells[i] = [];
	}

	const nbhdFFA = ids.qgmode.checked;

	let allowedNbhds = [];
	nbhds.forEach(n => {
		if (n.input.checked) allowedNbhds.push(n);
	});
	if (!nbhdFFA && !allowedNbhds.length) throw "can't play without any allowed nbhds";

	const cellSize = parseInt(ids.cellsize.value);

	this.allCells = [];
	ids.board.style.width = (this.width * cellSize)+'px';
	for (let j = this.height-1; j >= 0; --j) {
		const tr = document.createElement('tr');
		tr.style.width = (this.width * cellSize) + 'px';
		ids.board.appendChild(tr);
		for (let i = 0; i < this.width; ++i) {
			const dom = document.createElement('td');
			const cell = new Cell();
			cell.pos = [i,j];
			cell.dom = dom;
			dom.style.width = cellSize + 'px';
			dom.style.height = cellSize + 'px';
			dom.style.border = '1px solid black';
			dom.style.padding = '0px';
			dom.style.margin = '0px';
			dom.style.textAlign = 'center';
			dom.style.backgroundColor = '#9f9f9f';
			dom.style.overflow = 'hidden';
			dom.style.whitespace = 'nowrap';
			dom.style.cursor = 'default';
			dom.addEventListener('click', e => { cell.click(); });
			dom.addEventListener('contextmenu', e => {
				cell.setFlag();
				e.preventDefault();
			});
			dom.addEventListener('mouseenter', e => {
				if (!ids.hints.checked) return;
				
				// properties for !cell.hidden
				let color = '#ff0000';
				let ignoreHidden = false;
				
				let highlightCallback = cell2 => {
					if (ignoreHidden && cell2.hidden) return;
					const overlay = document.createElement('div');
					overlay.style.position = 'absolute';
					const rect = cell2.dom.getBoundingClientRect();
					const borderSize = 3;
					overlay.style.left = (rect.x + window.scrollX - borderSize) + 'px';
					overlay.style.top = (rect.y + window.scrollY - borderSize) + 'px';
					overlay.style.width = rect.width + 'px';
					overlay.style.height = rect.width + 'px';
					overlay.style.border = borderSize+'px solid '+color;
					// option ... put overlays on revealed tiles? or just dimly on revealed tiles...
					overlay.style.opacity = ignoreHidden ? .5 : (cell2.hidden ? .8 : .3);
					document.body.appendChild(overlay);
					grid.nbhdOverlays.push(overlay);
				};
				if (!cell.hidden) { 
					// option ... green overlay when all mines are marked?
					let flags = 0;
					cell.nbhdIter(cell2 => {
						if (cell2.flag == 1) flags++;
					});
					if (flags == cell.numTouch) color = '#00ff00';
					cell.nbhdIter(highlightCallback);
				} else {
					color = '#ffff00';
					ignoreHidden = true;
					cell.invNbhdCells.forEach(highlightCallback);
				}
				
			});
			dom.addEventListener('mouseleave', e => { grid.clearNbhdOverlays(); });
			let nbhd = !nbhdFFA
				? pickRandom(allowedNbhds)
				: createRandomNeighborhood(cell.pos);
			cell.nbhd = nbhd;
			if (!cell.nbhd) throw "couldn't find nbhd "+nbhd;
			tr.appendChild(dom);
			thiz.allCells.push(cell);
			thiz.cells[i][j] = cell;
		}
	}
	
	// TODO set neighborhoods *here* afterwar cell has been assigned
	// so we have cell.pos for the qg nbhd generator

	// now set random mines
	this.notMineCells = this.allCells.slice();
	this.numMines = Math.ceil(this.notMineCells.length * parseFloat(ids.percentMines.value) / 100);
	for (let i = 0; i < this.numMines; ++i) {
		this.popRandomNonMineCell().mine = true;
	}
	this.minesUnmarked = this.numMines;
	ids.minesleft.innerHTML = ''+grid.minesUnmarked;
	
	this.numHidden = this.width * this.height;
	// refresh after setting numHidden and minesUnmarked
	this.refreshUncoveredPercent();


	// store nbhd cells
	this.forEachCell(cell => {
		cell.nbhdCells = [];
		cell.nbhdIter(cell2 => {
			cell.nbhdCells.push(cell2);
		});
	});

	// store a list of all cells whose neighborhood touches this cell
	// this is the list that needs to be repopulated if this cells' mine status changes.
	this.forEachCell(cell => { cell.invNbhdCells = []; });
	this.forEachCell(cell => {
		cell.nbhdCells.forEach(cell2 => {
			cell2.invNbhdCells.push(cell);
		});
	});
	/* TODO if any cel's invNbhdCells is zero then that means no other cell indicates what this cell is
	  and you should probably re-roll some of its neighbors until that changes.
	 another method could be to do this:
	 	for each cell
			if no neighbors are looking at it yet:
				repeat
					pick a random enabled neighborhood pattern
						pick an inverse (pick a offset in the nbhd, place that at the cell, look at the nbhd origin)
							if that neighbor hasn't been assigned a neighborhood
							then set that neighboring cell to that neighborhood.
				... until we finally set a neighbor's neighborhood.
		then with whatever cells haven't been assigned , give them random nbhds.
	this will guaranteee that all cells are looked at by at least one cell
	*/

	// now count neighboring mines
	this.forEachCell(cell => cell.calculateNumTouch());
}
Grid.prototype = {
	popRandomNonMineCell : function() {
		const n = this.notMineCells.length;
		if (!n) throw "tried to pop a non-mine square when there was none left";
		return this.notMineCells.splice(parseInt(Math.random() * n), 1)[0];
	},
	forEachCell : function(f) {
		grid.cells.forEach((col, i) => {
			col.forEach((cell, j) => {
				f(cell, i, j);
			});
		});
	},
	// if a mine goes off we call this on all cells
	revealAllMinesUponFailure : function() {
		/* not iterators */
		this.forEachCell(cell => {
			if (!cell.hidden) return;
			if (cell.mine) cell.show(true);
		});
		/**/
		/* iterators?
		for (cell in cellIter()) {
			if (!cell.hidden) return;
			if (cell.mine) cell.show();
		}
		*/
	},
	clearNbhdOverlays : function() {
		this.nbhdOverlays.forEach(o => {
			o.parentNode.removeChild(o);
		});
		this.nbhdOverlays = [];
	},
	refreshUncoveredPercent : function() {
		const numRevealed = this.width * this.height
			- this.numHidden
			+ (this.numMines - this.minesUnmarked);
		const percentUncovered = numRevealed / (this.width * this.height);
		ids.percentUncovered.innerHTML = Math.floor(100*percentUncovered)+'%';
	},
	checkFirstClick : function(cell) {
		var thiz = this;
		if (this.clicked) return;
		this.clicked = true;

		this.startTime = Date.now();
		this.timerInterval = setInterval(() => {
			let dt = Math.floor((Date.now() - thiz.startTime) / 1000);
			let s = dt % 60;
			dt -= s;
			dt /= 60;
			let m = dt % 60;
			dt -= m;
			dt /= 60;
			let h = dt;
			// hmm printf in javascript?
			if (s < 10) s = '0'+s;
			if (m < 10) m = '0'+m;
			ids.timeTaken.innerHTML = h+':'+m+':'+s;
		}, 500);


		if (cell.mine) {
			cell.mine = false;
			const newmine = this.popRandomNonMineCell();
			newmine.mine = true;
			// update
			cell.calculateNumTouch();
			newmine.calculateNumTouch();
			cell.invNbhdCells.forEach(cell2 => {
				cell2.calculateNumTouch();
			});
			newmine.invNbhdCells.forEach(cell2 => {
				cell2.calculateNumTouch();
			});
			// add the old cell to the not-mine list
			this.notMineCells.push(cell);
		}
	},
	stopTimer : function() {
		if (this.timerInterval) clearInterval(this.timerInterval);
		this.timerInterval = undefined;
	},
	stopGame : function() {
		this.gamedone = true;
		this.stopTimer();
	},
};

//iterators?
function* cellIter() {
	/* how to yield across functions ...
	grid.cells.forEach((col, i) => {
		col.forEach((cell, j) => {
			yield cell;//, i, j;
		});
	});
	*/
	for (let i = 0; i < grid.width; ++i) {
		for (let j = 0; j < grid.height; ++j) {
			yield grid.cells[i][j];
		}
	}
};

function Cell(args) {
	this.hidden = true;
	this.flag = 0;
}
Cell.prototype = {
	// used to build nbhdCells so don't depend on nbhdCells here ...
	nbhdIter : function(f) {
		this.nbhd.gridPtIter(this.pos, cell => {
			f(cell);
		});
	},
	calculateNumTouch : function() {
		let thiz = this;
		this.numTouch = 0;
		this.nbhdCells.forEach(cell => {
			if (cell.mine) thiz.numTouch++;
		});
	},
	click : function() {
		if (grid.gamedone) return;
		if (this.flag) return;

		grid.checkFirstClick(this);

		if (!this.hidden) return;
		if (this.mine) {
			grid.stopGame();
			grid.revealAllMinesUponFailure();
			// and add a red overlay or something
			this.dom.style.backgroundColor = '#ff0000';
		} else {
			this.show();
			if (this.numTouch == 0) {
				this.nbhdCells.forEach(cell => {
					if (!cell.mine) {
						cell.click();
					}
				});
			}

			// remove from the non-mine cells
			const i = grid.notMineCells.indexOf(this);
			grid.notMineCells.splice(i, 1);
			if (grid.notMineCells.length == 0) {
				grid.stopGame();
				ids.timeTaken.appendChild(document.createTextNode(' YOU WIN'));
			}
		}
	},
	setFlag : function() {
		if (grid.gamedone) return;
		if (!this.hidden) return;
		// 0 = not marked
		// 1 = certain
		// 2 = uncertain
		if (this.flag == 1) grid.minesUnmarked++;
		this.flag++;
		this.flag %= 3;
		if (this.flag == 1) grid.minesUnmarked--;
		ids.minesleft.innerHTML = ''+grid.minesUnmarked;
		this.dom.innerHTML = (['', 'F', '?'])[this.flag];
		grid.refreshUncoveredPercent();
	},
	show : function(dontChangeUncovered) {
		if (!this.hidden) return;
		let text = this.nbhd.symbol;
		this.dom.style.backgroundColor = '#dfdfdf';
		if (this.mine) {
			text = '*';
		} else if (this.numTouch > 0) {
			text = this.numTouch + text;
			const colors = [
				'#7fff7f',
				'#ffff7f',
				'#ff7f7f',
				'#cf3f3f',
				'#7f7fcf',
				'#cf7fcf',
				'#7f3fcf',
				'#3f3f7f',
			];
			this.dom.style.backgroundColor = colors[(this.numTouch-1)%colors.length];
		}
		if (text) {
			this.dom.appendChild(
				document.createTextNode(''+text)
			);
		} else {
			// expose neighbors automatically ... ?
		}

		this.hidden = false;
		grid.numHidden--;
		if (!dontChangeUncovered) {
			grid.refreshUncoveredPercent();
		}
	},
};

function newgame() {
	if (grid) {
		grid.stopTimer();
		ids.timeTaken.innerHTML = '';
		grid.clearNbhdOverlays();
	}
	new Grid({
		size : [
			parseInt(ids.width.value),
			parseInt(ids.height.value),
		],
	});
}

ids.newgame.addEventListener('click', newgame);


document.body.addEventListener('keydown', e => {
	if (e.keyCode == 113) {	//F2
		e.preventDefault();
		newgame();
	}
});

newgame();
