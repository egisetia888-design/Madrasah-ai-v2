const fs = require('fs');
let code = fs.readFileSync('src/modules/graph/KnowledgeGraphPage.tsx', 'utf8');

// Insert useEffect after state declarations
const insertionPoint = 'const [filters, setFilters] = useState({\n    note: true,\n    concept: true,\n    book: true,\n    author: true\n  })';

const effectCode = `

  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchTerm(search);
    }
  }, [searchParams]);
`;

code = code.replace(insertionPoint, insertionPoint + effectCode);
fs.writeFileSync('src/modules/graph/KnowledgeGraphPage.tsx', code);
