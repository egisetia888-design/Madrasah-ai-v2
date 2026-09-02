const fs = require('fs');
let code = fs.readFileSync('src/modules/graph/KnowledgeGraphPage.tsx', 'utf8');

// Insert useEffect after state declarations
const insertionPoint = 'const [filters, setFilters] = useState({\n    note: true,\n    concept: true,\n    book: true,\n    author: true\n  })';

const effectCode = `

  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchTerm(search);
      // Let's also try to select the node if there is a match
      setTimeout(() => {
         const exactMatch = rawNodes.find(n => n.label.toLowerCase() === search.toLowerCase());
         if (exactMatch) setSelectedNodeId(exactMatch.id);
      }, 500);
    }
  }, [searchParams, rawNodes]);
`;

code = code.replace(insertionPoint, insertionPoint + effectCode);
fs.writeFileSync('src/modules/graph/KnowledgeGraphPage.tsx', code);
