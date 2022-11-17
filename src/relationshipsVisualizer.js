const makeTableNodeLabel = (tableName, columnNames, columnTypes, foreignKeys) => {
    let label = ` ${tableName} `
    for (let i = 0; i < columnNames.length; i++) {
        label += "\n\n";
        label += `  ${columnNames[i]} ${columnTypes[i]}`
        if (foreignKeys.has(columnNames[i])) {
            label += "(FK)  "
        } else {
            label += "  "
        }
    }
    return label;
}

const genGradientString = (nCols) => {
    const labelFraction = 1 / (nCols + 1);
    return 'style=filled gradientangle=270 fillcolor=' + `"white;${labelFraction}:#f3ecea"`
}

const populateForeignKeysAndRelations = (foreignKeysQuery, relations, foreignKeys, tableName) => {
    if (foreignKeysQuery.length == 0) {
        return;
    }
    for (const values of foreignKeysQuery[0].values) {
        fkColName = values[3];
        if (relations.has(tableName)) {
            relations.set(tableName, [].concat([values[2]], relations.get(tableName)));
        } else {
            relations.set(tableName, [values[2]]);
        }
        foreignKeys.add(fkColName);
    }
}

const getColumnInformation = (tableInfo) => {
    const columnNames = [];
    const columnTypes = [];

    for (const column of tableInfo[0].values) {
        const columnName = column[1]
        const columnType = column[2]
        columnNames.push(columnName)
        columnTypes.push(columnType)
    }

    return [columnNames, columnTypes];
}

const getTableNames = (db) => {
    return db.exec('SELECT name FROM sqlite_master WHERE type = "table"')[0]
        .values
        .map((v, _) => v[0])
        .filter((v) => !v.includes('sqlite'));
}

const generateNodeStrings = (tableNames, tableNodeLabels, tableGradientStrings) => {
    const nodeStrings = [];
    for (const tableName of tableNames) {
        nodeStrings.push(
            `"  ${tableNodeLabels.get(tableName)}  "[margin=0 width=0.5 shape=square ${tableGradientStrings.get(tableName)}]`
        );
    }
    return nodeStrings;
}

const generateNodeRelationshipStrings = (relations, tableNodeLabels) => {
    const nodeRelationshipStrings = [];
    for (const [from, targets] of relations.entries()) {
        for (const target of targets) {
            nodeRelationshipStrings.push(`"  ${tableNodeLabels.get(from)}  " -> "  ${tableNodeLabels.get(target)}  "`);
        }
    }
    return nodeRelationshipStrings;
}

const generateGraph = (nodeStrings, nodeRelationshipStrings) => {
    let graph = "digraph DB {\n  {\n";
    for (const nodeString of nodeStrings) {
        graph += nodeString;
        graph += "\n";
    }
    graph += "}\n";
    for (const nodeRelationshipString of nodeRelationshipStrings) {
        graph += nodeRelationshipString;
        graph += "\n";
    }
    graph += "}\n";
    return graph;
}

let config = {
    locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`,
};

initSqlJs(config).then(function (SQL) {

    const dbFileElm = document.getElementById('dbLoader')
    dbFileElm.onchange = () => {

        const f = dbFileElm.files[0];
        const r = new FileReader();
        r.onload = function () {

            const relations = new Map();
            const foreignKeys = new Set();
            const tableNodeLabels = new Map();
            const tableGradientStrings = new Map()
            const Uints = new Uint8Array(r.result);
            const db = new SQL.Database(Uints);
            const tableNames = getTableNames(db);

            for (const tableName of tableNames) {
                const tableInfo = db.exec(`PRAGMA table_info(${tableName})`);
                const foreignKeysQuery = db.exec(`PRAGMA foreign_key_list(${tableName})`);

                foreignKeys.clear();
                populateForeignKeysAndRelations(foreignKeysQuery, relations, foreignKeys, tableName);

                const [columnNames, columnTypes] = getColumnInformation(tableInfo);

                const label = makeTableNodeLabel(tableName, columnNames, columnTypes, foreignKeys);
                const gradientString = genGradientString(columnNames.length)
                tableNodeLabels.set(tableName, label);
                tableGradientStrings.set(tableName, gradientString);
            }

            const nodeStrings = generateNodeStrings(tableNames, tableNodeLabels, tableGradientStrings);
            const nodeRelationshipStrings = generateNodeRelationshipStrings(relations, tableNodeLabels);
            const graph = generateGraph(nodeStrings, nodeRelationshipStrings);

            d3.select("#graph")
                .graphviz()
                .width(1000)
                .height(500)
                .engine('fdp')
                .dot(graph)
                .render();

        }
        r.readAsArrayBuffer(f);
    }
});