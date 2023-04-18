let grid;

const body = document.body;

function posmod(x,y) {
	return ((x % y) + y) % y;
}

function Text(text) {
	return document.createTextNode(text);
}

function DOM(tag, args, style, listeners) {
	const dom = document.createElement(tag);
	if (args) {
		for (let k in args) {
			dom[k] = args[k];
		}
	}
	if (style) {
		for (let k in style) {
			dom.style[k] = style[k];
		}
	}
	if (listeners) {
		for (let k in listeners) {
			dom.addEventListener(k, listeners[k]);
		}
	}
	return dom;
}

const ids = {};
document.querySelectorAll('[id]').forEach(n => {
	ids[n.id] = n;
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
		this.input = DOM(
			'input',
			{
				type : 'checkbox',
				checked : checked,
			},
			null,
			{
				change : changedConfig,
			}
		);
		ids.nbhddiv.appendChild(Text('('+this.desc+') '+this.symbol));
		ids.nbhddiv.appendChild(this.input);
		ids.nbhddiv.appendChild(DOM('br'));
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

function makeDxys(r, f) {
	let n = [];
	for (let dx = -r; dx <= r; ++dx) {
		for (let dy = -r; dy <= r; ++dy) {
			if (!(dx == 0 && dy == 0) && f(dx,dy)) n.push([dx,dy]);
		}
	}
	return n;
}

const nbhds = [
	new Neighborhood(makeDxys(1, (x,y) => { return true; }), 'o', '3x3', true),
	new Neighborhood(makeDxys(1, (x,y) => { return x==0 || y==0; }), '+', '3x3 cardinals', true),
	new Neighborhood(makeDxys(1, (x,y) => { return x!=0 && y!=0; }), 'x', '3x3 diagonals', true),
	
	new Neighborhood(makeDxys(2, (x,y) => { return true; }), 'O', '5x5', true),
	new Neighborhood(makeDxys(2, (x,y) => { return x==0 || y==0; }), 'P', '5x5 cardinals', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(x)==Math.abs(y); }), 'X', '5x5 diagonals', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(x)!=0 && Math.abs(y)!=0; }), 'F', '5x5 corners', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(x)<=1; }), 'A', '3x5', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(y)<=1; }), 'B', '5x3', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(x) + Math.abs(y) <= 2; }), 'G', '5x5 diamond', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(x)==2 || Math.abs(y)==2; }), 'C', '5x5 hollow', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.max(Math.abs(x), Math.abs(y)/2)==1; }), 'D', '3x5 hollow', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.max(Math.abs(x)/2, Math.abs(y))==1; }), 'E', '5x3 hollow', true),
	new Neighborhood(makeDxys(2, (x,y) => { return Math.abs(x) + Math.abs(y) == 2; }), 'G', '5x5 hollow diamond', true),
	
	new Neighborhood(makeDxys(3, (x,y) => { return true; }), 'aa', '7x7 square', false),
	new Neighborhood(makeDxys(3, (x,y) => { return Math.abs(x)>1 || Math.abs(y)>1; }), 'aa', '7x7 square 2-thick', false),
	new Neighborhood(makeDxys(3, (x,y) => { return Math.abs(x)==3 || Math.abs(y)==3; }), 'aa', '7x7 hollow square', false),
	new Neighborhood(makeDxys(3, (x,y) => { return Math.abs(x) + Math.abs(y) == 3; }), 'aa', '7x7 hollow diamond', false),

	new Neighborhood([[-1,1]], 'ul', 'up left', false),
	new Neighborhood([[1,1]], 'ur', 'up right', false),
	new Neighborhood([[-1,-1]], 'dl', 'down left', false),
	new Neighborhood([[1,-1]], 'dr', 'down right', false),

	new Neighborhood([[0,1]], 'u', 'up', false),
	new Neighborhood([[0,-1]], 'd', 'down', false),
	new Neighborhood([[-1,0]], 'l', 'left', false),
	new Neighborhood([[1,0]], 'r', 'right', false),

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

	const cellSize = parseInt(ids.cellsize.value);
	ids.board.style.width = (this.width * cellSize)+'px';
	for (let j = this.height-1; j >= 0; --j) {
		const tr = DOM('tr');
		tr.style.width = (this.width * cellSize) + 'px';
		ids.board.appendChild(tr);
		for (let i = 0; i < this.width; ++i) {
			const cell = new Cell();
			cell.pos = [i,j];
			const dom = DOM(
				'td',
				undefined,
				{
					width : cellSize + 'px',
					height : cellSize + 'px',
					border : '1px solid black',
					padding : '0px',
					margin : '0px',
					textAlign : 'center',
					backgroundColor : '#9f9f9f',
					overflow : 'hidden',
					whitespace : 'nowrap',
					cursor : 'default',
				},
				{
					click : e => { cell.click(); },
					contextmenu : e => {
						cell.setFlag();
						e.preventDefault();
					},
					mouseenter : e => { cell.makeNbhdOverlays(); },
					mouseleave : e => { grid.clearNbhdOverlays(); },
				}
			);
			cell.dom = dom;
			tr.appendChild(dom);
			thiz.cells[i][j] = cell;
		}
	}

	this.allCells = [];
	this.forEachCell(cell => {
		thiz.allCells.push(cell);
	});
	
	// set neighborhoods here after cell has been assigned
	// so we have cell.pos for the qg nbhd generator
	
	const nbhdFFA = ids.qgmode.checked;
	let allowedNbhds = [];
	nbhds.forEach(n => {
		if (n.input.checked) allowedNbhds.push(n);
	});
	if (!nbhdFFA && !allowedNbhds.length) throw "can't play without any allowed nbhds";

	this.forEachCell(cell => {
		let nbhd = !nbhdFFA
			? pickRandom(allowedNbhds)
			: createRandomNeighborhood(cell.pos);
		cell.nbhd = nbhd;
		if (!cell.nbhd) throw "couldn't find nbhd "+nbhd;
	});

	// build nbhdCells based on nbhd
	
	this.forEachCell(cell => {
		cell.nbhdCells = [];
		cell.nbhd.gridPtIter(cell.pos, cell2 => {
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
}
Grid.prototype = {
	popRandomNonMineCell : function() {
		const n = this.notMineCells.length;
		if (!n) throw "tried to pop a non-mine square when there was none left";
		return this.notMineCells.splice(parseInt(Math.random() * n), 1)[0];
	},
	forEachCell : function(f) {
		this.cells.forEach((col, i) => {
			col.forEach((cell, j) => {
				f(cell, i, j);
			});
		});
	},
	setupMines : function(firstClickCell) {
		const thiz = this;
		// now set random mines
		this.notMineCells = this.allCells.slice();
	
		// create a nbhd of cells around our first-click cell
		const safeCells = [];
		/* pick a 3x3 neighborhood aroudn the first cell * /
		new Neighborhood(makeDxys(1, (x,y) => { return true; })).gridPtIter(firstClickCell.pos, cell => {
			safeCells.push(cell);
		});
		/**/
		/* use the cell's own neighborhood
		-- guarantee first click always propagates */
		firstClickCell.nbhdCells.forEach(cell => {
			safeCells.push(cell);
		});
		/**/
		
		// remove that neighborhood from the choices
		safeCells.forEach(cell => {
			const i = thiz.notMineCells.indexOf(cell);
			if (i == -1) throw "here";
			thiz.notMineCells.splice(i, 1);
		});
		
		// distribute mines
		this.numMines = 0;
		const targetNumMines = Math.ceil(this.allCells.length * parseFloat(ids.percentMines.value) / 100);
		for (let i = 0; i < targetNumMines; ++i) {
			const cell = this.popRandomNonMineCell();
			if (!cell) break;
			cell.mine = true;
			++this.numMines;
		}
		// re-add the removed safe cells
		safeCells.forEach(cell => { thiz.notMineCells.push(cell); });
		
		this.minesUnmarked = this.numMines;
		ids.minesleft.innerHTML = ''+grid.minesUnmarked;
		
		this.numHidden = this.width * this.height;
		// refresh after setting numHidden and minesUnmarked
		this.refreshUncoveredPercent();

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
		for (let cell in cellIter()) {
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
		const thiz = this;
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

		this.setupMines(cell);

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
	nbhdIter : function(f) {
		this.nbhdCells.forEach(f);
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
				ids.timeTaken.appendChild(Text(' YOU WIN'));
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
			this.dom.appendChild(Text(''+text));
		} else {
			// expose neighbors automatically ... ?
		}

		this.hidden = false;
		grid.numHidden--;
		if (!dontChangeUncovered) {
			grid.refreshUncoveredPercent();
		}
	},
	makeNbhdOverlays : function() {
		if (!ids.hints.checked) return;
		
		// properties for !cell.hidden
		let color = '#ff0000';
		let ignoreHidden = false;
		
		let highlightCallback = cell2 => {
			if (ignoreHidden && cell2.hidden) return;
			const overlay = DOM('div');
			overlay.style.position = 'absolute';
			const rect = cell2.dom.getBoundingClientRect();
			const borderSize = 3;
			overlay.style.left = (rect.x + window.scrollX) + 'px';
			overlay.style.top = (rect.y + window.scrollY) + 'px';
			overlay.style.width = (rect.width - 2*borderSize-1) + 'px';
			overlay.style.height = (rect.width - 2*borderSize-1) + 'px';
			overlay.style.border = borderSize+'px solid '+color;
			// option ... put overlays on revealed tiles? or just dimly on revealed tiles...
			overlay.style.opacity = ignoreHidden ? .5 : (cell2.hidden ? .8 : .3);
			body.appendChild(overlay);
			grid.nbhdOverlays.push(overlay);
		};
		if (!this.hidden) { 
			// option ... green overlay when all mines are marked?
			let flags = 0;
			this.nbhdIter(cell2 => {
				if (cell2.flag == 1) flags++;
			});
			if (flags == this.numTouch) color = '#00ff00';
			this.nbhdIter(highlightCallback);
		} else {
			color = '#ffff00';
			ignoreHidden = true;
			this.invNbhdCells.forEach(highlightCallback);
		}
	},
};

function newgame() {
	if (grid) {
		grid.stopTimer();
		ids.timeTaken.innerHTML = '...';
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

body.addEventListener('keydown', e => {
	if (e.keyCode == 113) {	//F2
		e.preventDefault();
		newgame();
	}
});

newgame();
