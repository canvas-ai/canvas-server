document.addEventListener('DOMContentLoaded', () => {
    const treeContainer = document.getElementById('workspace-tree');
    const contentView = document.getElementById('content-view');
    const currentPathSpan = document.getElementById('current-path');
    let selectedNodeElement = null;

    // --- Helper Functions ---

    // Generic fetch wrapper with basic error handling and token
    async function fetchData(url) {
        // Assumption: The service expects the token via environment variables,
        // but the browser needs to send it. We need a way to get the token here.
        // HARDCODING FOR NOW - THIS IS INSECURE!
        const token = 'test-api-token'; // Replace with a secure way to get the token

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'API request failed');
            }
            return data.data;
        } catch (error) {
            console.error('Fetch error:', error);
            contentView.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
            return null;
        }
    }

    // Recursive function to render the tree
    function renderTree(node, parentElement, pathPrefix = '') {
        const listItem = document.createElement('li');
        const nodePath = pathPrefix + '/' + node.name;

        const label = document.createElement('span');
        label.textContent = node.name || '/'; // Display '/' for root
        label.classList.add('node-label');
        label.dataset.path = nodePath.startsWith('//') ? nodePath.substring(1) : nodePath; // Store full path
        if (label.dataset.path === '') label.dataset.path = '/'; // Ensure root is /

        listItem.appendChild(label);

        if (node.children && node.children.length > 0) {
            const childrenList = document.createElement('ul');
            node.children.forEach(child => renderTree(child, childrenList, nodePath));
            listItem.appendChild(childrenList);
        }

        parentElement.appendChild(listItem);
    }

    // Function to load and display documents for a path
    async function loadDocuments(path) {
        currentPathSpan.textContent = `(${path})`;
        contentView.innerHTML = '<p>Loading documents...</p>';
        const documents = await fetchData(`/api/v1/documents?path=${encodeURIComponent(path)}`);

        if (documents) {
            if (documents.length === 0) {
                contentView.innerHTML = '<p>No documents found at this path.</p>';
            } else {
                contentView.innerHTML = documents.map(doc =>
                    `<pre>${JSON.stringify(doc, null, 2)}</pre>`
                ).join('');
            }
        } else {
            // Error message handled by fetchData
             contentView.innerHTML = '<p>Failed to load documents.</p>';
        }
    }

    // --- Event Listeners ---

    // Handle clicks on tree nodes
    treeContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('node-label')) {
            const clickedPath = event.target.dataset.path;

            // Remove selection from previously selected node
            if (selectedNodeElement) {
                selectedNodeElement.classList.remove('selected');
            }

            // Add selection to the clicked node
            selectedNodeElement = event.target;
            selectedNodeElement.classList.add('selected');

            console.log('Node clicked:', clickedPath);
            loadDocuments(clickedPath);
        }
    });

    // --- Initial Load ---

    async function initialize() {
        treeContainer.innerHTML = '<li>Loading tree...</li>';
        const treeData = await fetchData('/api/v1/tree');

        if (treeData) {
            treeContainer.innerHTML = ''; // Clear loading message
            // The API returns the root node directly
            renderTree(treeData, treeContainer, '');
            // Optionally load documents for root initially
            // loadDocuments('/');
        } else {
            treeContainer.innerHTML = '<li>Failed to load tree.</li>';
        }
    }

    initialize();
});
