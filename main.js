let grid;

// TODO base on document size
let cellSize = 24;

const ids = {};
[
	'go', 'board', 'width', 'height', 'percentMines',
	// nbhds:
	'nbhd_4p', 'nbhd_4x', 'nbhd_8',
].forEach(f => {
	ids[f] = document.getElementById(f);
});
window.ids = ids;

function Neighborhood(symbol, n) {
	this.symbol = symbol;
	this.n = n;
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

const neighborhoods = {
	_4p : new Neighborhood('+', [[1,0],[-1,0],[0,1],[0,-1]]),
	_4x : new Neighborhood('x', [[1,1],[1,-1],[-1,1],[-1,-1]]),
	_8 : new Neighborhood('o', (() => {	// union of the above two
		const n = [];
		for (let dx = -1; dx <= 1; ++dx) {
			for (let dy = -1; dy <= 1; ++dy) {
				if (!(dx == 0 && dy == 0)) {
					n.push([dx,dy]);
				}
			}
		}
		return n;
	})()),
};
let nbhdKeys = [];
for (let k in neighborhoods) nbhdKeys.push(k);

function pickRandom(ar) {
	return ar[parseInt(Math.random() * ar.length)];
}

function Grid(args) {
	grid = this;	//assign here so ctor calls can access 'grid'
window.grid = grid;
	const thiz = this;
	this.clicked = false;
	[this.width, this.height] = args.size;
	ids.board.innerHTML = '';
	this.notMineCells = [];
	this.cells = [];
	for (let i = 0; i < this.width; ++i) {
		this.cells[i] = [];
	}
	let allowedNbhds = [];
	nbhdKeys.forEach(k => {
		if (ids['nbhd'+k].checked) allowedNbhds.push(k);
	});
	if (!allowedNbhds.length) throw "can't play without any allowed nbhds";
	for (let j = 0; j < this.height; ++j) {
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
			dom.style.backgroundColor = 'grey';
			dom.style.cursor = 'default';
			dom.addEventListener('click', e => { cell.click(); });
			dom.addEventListener('contextmenu', e => { 
				cell.setFlag();
				e.preventDefault();
			});
			let nbhdType = pickRandom(allowedNbhds);
			cell.nbhd = neighborhoods[nbhdType];
			if (!cell.nbhd) throw "couldn't find nbhd "+nbhdType;
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
	
	// store nbhd cells
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
		then with whatever cells haven't been assigned , give them random neighborhoods.
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
	showAll : function() {
		/* not iterators */
		this.forEachCell(cell => cell.show());
		/**/
		/* iterators?
		for (cell in cellIter()) {
			cell.show();
		}
		*/
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
	calculateNumTouch : function() {
		var thiz = this;
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
				this.nbhdCells.forEach(cell => {
					cell.calculateNumTouch();
				});
				newmine.nbhdCells.forEach(cell => {
					cell.calculateNumTouch();
				});
				grid.notMineCells.push(this);
			}
		}

		if (!this.hidden) return;
		if (this.mine) {
			grid.showAll();
			// and add a red overlay or something
			this.dom.style.backgroundColor = 'red';
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
		this.flag++;
		this.flag %= 3;
		this.dom.innerHTML = (['', 'F', '?'])[this.flag];
	},
	show : function() {
		if (!this.hidden) return;
		let text = this.nbhd.symbol;
		this.dom.style.backgroundColor = '#cfcfcf';
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
};

function go() {
	new Grid({
		size : [
			parseInt(ids.width.value),
			parseInt(ids.height.value),
		],
	});
}

ids.go.addEventListener('click', go);

go();
