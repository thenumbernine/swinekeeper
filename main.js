let grid;

// TODO base on document size
let cellSize = 24;

const ids = {};
[
	'newgame', 'board', 'width', 'height', 'percentMines', 'minesleft',
	'nbhddiv',
].forEach(f => {
	ids[f] = document.getElementById(f);
});
window.ids = ids;

function Neighborhood(symbol, desc, checked, n) {
	this.symbol = symbol;
	this.desc = desc;
	this.n = n;

	this.input = document.createElement('input');
	this.input.type = 'checkbox';
	this.input.checked = checked;
	ids.nbhddiv.appendChild(document.createTextNode('('+this.desc+') '+this.symbol));
	ids.nbhddiv.appendChild(this.input);
	ids.nbhddiv.appendChild(document.createElement('br'));
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
			const x = i+dx;
			const y = j+dy;
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
	new Neighborhood('o', 'L-inf=1', true, [
		[1,0],[-1,0],[0,1],[0,-1],
		[1,1],[1,-1],[-1,1],[-1,-1]
	]),
	new Neighborhood('+', 'cardinal', true, [[1,0],[-1,0],[0,1],[0,-1]]),
	new Neighborhood('x', 'diagonal', true, [[1,1],[1,-1],[-1,1],[-1,-1]]),

	new Neighborhood('ul', 'up left', false, [[-1,1]]),
	new Neighborhood('ur', 'up right', false, [[1,1]]),
	new Neighborhood('dl', 'down left', false, [[-1,-1]]),
	new Neighborhood('dr', 'down right', false, [[1,-1]]),

	new Neighborhood('u', 'up', false, [[0,1]]),
	new Neighborhood('d', 'down', false, [[0,-1]]),
	new Neighborhood('l', 'left', false, [[-1,0]]),
	new Neighborhood('r', 'right', false, [[1,0]]),

	// TODO how about all possible combinations of L-inf=1, 2, etc ?
	new Neighborhood('X', 'diagonal-2', true,
		(()=>{
			const n = [];
			for (let i = 1; i <= 2; ++i) {
				n.push([i,i]);
				n.push([i,-i]);
				n.push([-i,i]);
				n.push([-i,-i]);
			}
			return n;
		})()
	),
	new Neighborhood('P', 'cardinal-2', true,
		(()=>{
			const n = [];
			for (let i = 1; i <= 2; ++i) {
				n.push([0,i]);
				n.push([0,-i]);
				n.push([i,0]);
				n.push([-i,0]);
			}
			return n;
		})()
	),
	new Neighborhood('O', 'L-inf=2', true,
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
		})()
	),
];
window.nbhds = nbhds;

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

	this.notMineCells = [];

	this.cells = [];
	for (let i = 0; i < this.width; ++i) {
		this.cells[i] = [];
	}

	let allowedNbhds = [];
	nbhds.forEach(n => {
		if (n.input.checked) allowedNbhds.push(n);
	});
	if (!allowedNbhds.length) throw "can't play without any allowed nbhds";

	for (let j = this.height-1; j >= 0; --j) {
		const tr = document.createElement('tr');
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
			dom.style.cursor = 'default';
			dom.addEventListener('click', e => { cell.click(); });
			dom.addEventListener('contextmenu', e => {
				cell.setFlag();
				e.preventDefault();
			});
			dom.addEventListener('mouseenter', e => {
				if (cell.hidden) return;
				cell.nbhdIter(cell2 => {
					// option ... put overlays on revealed tiles?
					const overlay = document.createElement('div');
					overlay.style.position = 'absolute';
					const rect = cell2.dom.getBoundingClientRect();
					const borderSize = 3;
					overlay.style.left = (rect.x + window.scrollX - borderSize) + 'px';
					overlay.style.top = (rect.y + window.scrollY - borderSize) + 'px';
					overlay.style.width = rect.width + 'px';
					overlay.style.height = rect.width + 'px';
					overlay.style.border = borderSize+'px solid #ff0000';
					overlay.style.opacity = cell2.hidden ? .8 : .3;
					document.body.appendChild(overlay);
					grid.nbhdOverlays.push(overlay);
				});
			});
			dom.addEventListener('mouseleave', e => { grid.clearNbhdOverlays(); });
			let nbhd = pickRandom(allowedNbhds);
			cell.nbhd = nbhd;
			if (!cell.nbhd) throw "couldn't find nbhd "+nbhd;
			tr.appendChild(dom);
			thiz.notMineCells.push(cell);
			thiz.cells[i][j] = cell;
		}
	}

	// now set random mines
	const numMines = Math.ceil(this.notMineCells.length * parseFloat(ids.percentMines.value) / 100);
	for (let i = 0; i < numMines; ++i) {
		this.popRandomNonMineCell().mine = true;
	}
	grid.minesMarked = numMines;
	ids.minesleft.innerHTML = ''+grid.minesMarked;

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
	revealAllMines : function() {
		/* not iterators */
		this.forEachCell(cell => cell.revealMine());
		/**/
		/* iterators?
		for (cell in cellIter()) {
			cell.show();
		}
		*/
	},
	clearNbhdOverlays : function() {
		this.nbhdOverlays.forEach(o => {
			o.parentNode.removeChild(o);
		});
		this.nbhdOverlays = [];
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
		if (this.flag) return;

		if (!grid.clicked) {
			grid.clicked = true;
			if (this.mine) {
				this.mine = false;
				const newmine = grid.popRandomNonMineCell();
				newmine.mine = true;
				// update
				this.calculateNumTouch();
				newmine.calculateNumTouch();
				this.invNbhdCells.forEach(cell => {
					cell.calculateNumTouch();
				});
				newmine.invNbhdCells.forEach(cell => {
					cell.calculateNumTouch();
				});
				// add the old cell to the not-mine list
				grid.notMineCells.push(this);
			}
		}

		if (!this.hidden) return;
		if (this.mine) {
			grid.revealAllMines();
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
				document.body.appendChild(document.createTextNode('YOU WIN'));
			}
		}
	},
	setFlag : function() {
		if (!this.hidden) return;
		// 0 = not marked
		// 1 = certain
		// 2 = uncertain
		if (this.flag == 1) grid.minesMarked++;
		this.flag++;
		this.flag %= 3;
		if (this.flag == 1) grid.minesMarked--;
		ids.minesleft.innerHTML = ''+grid.minesMarked;
		this.dom.innerHTML = (['', 'F', '?'])[this.flag];
	},
	show : function() {
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
	},
	// if a mine goes off we call this on all cells
	revealMine : function() {
		if (!this.hidden) return;
		if (this.mine) this.show();
	}
};

function newgame() {
	if (grid) grid.clearNbhdOverlays();
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
