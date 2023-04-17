let grid;

// TODO base on document size
let cellSize = 24;

let ids = {};
['go', 'board', 'width', 'height', 'percentMines'].forEach(f => {
	ids[f] = document.getElementById(f);
});

function Grid(args) {
	grid = this;	//assign here so ctor calls can access 'grid'
	let thiz = this;
	this.clicked = false;
	this.width = args.size[0];
	this.height = args.size[1];
	ids.board.innerHTML = '';
	this.notMineCells = [];
	this.cells = [];
	for (let i = 0; i < this.width; ++i) {
		this.cells[i] = [];
	}
	for (let j = 0; j < this.height; ++j) {
		let tr = document.createElement('tr');
		ids.board.appendChild(tr);
		for (let i = 0; i < this.width; ++i) {
			let dom = document.createElement('td');
			let cell = new Cell();
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
			tr.appendChild(dom);
			thiz.notMineCells.push(cell);
			thiz.cells[i][j] = cell;
		}
	}
	
	// now set random mines
	let numMines = Math.ceil(this.notMineCells.length * parseFloat(ids.percentMines.value) / 100);
	for (let i = 0; i < numMines; ++i) {
		let cell = this.popRandomNonMineCell();
		cell.mine = true;
	}
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
}
Cell.prototype = {
	nbhdIter : function(f) {
		let i = this.pos[0];
		let j = this.pos[1];
		for (let dx = -1; dx <= 1; ++dx) {
			for (let dy = -1; dy <= 1; ++dy) {
				let x = i+dx;
				let y = j+dy;
				if (x >= 0 &&
					x < grid.width &&
					y >= 0 &&
					y < grid.height
				) {
					f(grid.cells[x][y], dx, dy);
				}
			}
		}
	},
	calculateNumTouch : function() {
		let numTouch = 0;
		this.nbhdIter(cell => {
			if (cell.mine) numTouch++;
		});
		this.numTouch = numTouch;
	},
	click : function() {
		if (grid.flag) return;
		
		if (!grid.clicked) {
			grid.clicked = true;
			if (this.mine) {
				this.mine = false;
				let newmine = grid.popRandomNonMineCell();
				newmine.mine = true;
				this.nbhdIter(cell => {
					cell.calculateNumTouch();
				});
				newmine.nbhdIter(cell => {
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
				this.nbhdIter(cell => {
					if (!cell.mine) {
						cell.click();
					}
				});
			}
	
			// remove from the non-mine cells
			let i = grid.notMineCells.indexOf(this);
			grid.notMineCells.splice(i, 1);
			if (grid.notMineCells.length == 0) {
				document.body.appendChild(document.createTextNode('YOU WIN'));
			}
		}
	},
	setFlag : function() {
		if (!this.hidden) return;
		if (this.flag) {
			this.flag = false;
			this.dom.innerHTML = '';
		} else {
			this.flag = true;
			this.dom.innerHTML = 'F';
		}
	},
	show : function() {
		if (!this.hidden) return;
		let text;
		this.dom.style.backgroundColor = '#cfcfcf';
		if (this.mine) {
			text = '*';
		} else if (this.numTouch > 0) {
			text = this.numTouch;
			var colors = [
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

let go = () => {
	new Grid({
		size : [
			parseInt(ids.width.value),
			parseInt(ids.height.value),
		],
	});
};

ids.go.addEventListener('click', go);

go();

window.grid = grid;
window.ids = ids;
