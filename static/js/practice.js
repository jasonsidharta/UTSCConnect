// ============================================
// Practice Section — C Coding Challenges
// ============================================

const STRUCT_DEFS = {
    "linked-list": `typedef struct Node {
    int data;
    struct Node *next;
} Node;`,
    "bst": `typedef struct BSTNode {
    int key;
    struct BSTNode *left;
    struct BSTNode *right;
} BSTNode;`,
};

const TOPICS = {
    "linked-list": {
        title: "Linked List",
        description: "Master pointer manipulation with linked list operations",
        icon: "L",
        color: "#2ecc71",
        problems: [
            { id: "insert_at_head", name: "insert_at_head()", difficulty: "EASY", description: "Insert a new node at the front of a linked list in O(1).", signature: "void insert_at_head(Node **head, int val)", starterCode: "void insert_at_head(Node **head, int val) {\n\n}", solution: "void insert_at_head(Node **head, int val) {\n    Node *n = malloc(sizeof(Node));\n    n->data = val;\n    n->next = *head;\n    *head = n;\n}", hint: "Allocate a new node, point its next to current head, then update head." },
            { id: "insert_at_tail", name: "insert_at_tail()", difficulty: "EASY", description: "Insert a new node at the END of a linked list (O(n)).", signature: "void insert_at_tail(Node **head, int val)", starterCode: "void insert_at_tail(Node **head, int val) {\n\n}", solution: "void insert_at_tail(Node **head, int val) {\n    Node *n = malloc(sizeof(Node));\n    n->data = val;\n    n->next = NULL;\n    if (*head == NULL) { *head = n; return; }\n    Node *cur = *head;\n    while (cur->next) cur = cur->next;\n    cur->next = n;\n}", hint: "Handle empty list. Otherwise traverse to the last node and append." },
            { id: "delete_node", name: "delete_node()", difficulty: "MEDIUM", description: "Remove the first node whose data matches a given value.", signature: "void delete_node(Node **head, int val)", starterCode: "void delete_node(Node **head, int val) {\n\n}", solution: "void delete_node(Node **head, int val) {\n    if (!*head) return;\n    if ((*head)->data == val) {\n        Node *tmp = *head;\n        *head = (*head)->next;\n        free(tmp);\n        return;\n    }\n    Node *cur = *head;\n    while (cur->next && cur->next->data != val)\n        cur = cur->next;\n    if (cur->next) {\n        Node *tmp = cur->next;\n        cur->next = tmp->next;\n        free(tmp);\n    }\n}", hint: "Handle head deletion separately. Then find the node before the target." },
            { id: "print_list", name: "print_list()", difficulty: "EASY", description: "Traverse and print every node value in the list.", signature: "void print_list(Node *head)", starterCode: "void print_list(Node *head) {\n\n}", solution: "void print_list(Node *head) {\n    Node *cur = head;\n    while (cur) {\n        printf(\"%d \", cur->data);\n        cur = cur->next;\n    }\n    printf(\"\\n\");\n}", hint: "Use a while loop, print data, move to next." },
            { id: "free_list", name: "free_list()", difficulty: "EASY", description: "Free every dynamically allocated node in the list.", signature: "void free_list(Node *head)", starterCode: "void free_list(Node *head) {\n\n}", solution: "void free_list(Node *head) {\n    Node *cur = head;\n    while (cur) {\n        Node *tmp = cur;\n        cur = cur->next;\n        free(tmp);\n    }\n}", hint: "Save next before freeing current node." },
            { id: "search_list", name: "search_list()", difficulty: "MEDIUM", description: "Search for a value and return a pointer to its node.", signature: "Node* search_list(Node *head, int val)", starterCode: "Node* search_list(Node *head, int val) {\n\n}", solution: "Node* search_list(Node *head, int val) {\n    Node *cur = head;\n    while (cur) {\n        if (cur->data == val) return cur;\n        cur = cur->next;\n    }\n    return NULL;\n}", hint: "Traverse and compare each node's data to val." },
            { id: "list_length", name: "list_length()", difficulty: "EASY", description: "Count and return the number of nodes in the list.", signature: "int list_length(Node *head)", starterCode: "int list_length(Node *head) {\n\n}", solution: "int list_length(Node *head) {\n    int count = 0;\n    Node *cur = head;\n    while (cur) { count++; cur = cur->next; }\n    return count;\n}", hint: "Initialize counter to 0, increment for each node." },
            { id: "reverse_list", name: "reverse_list()", difficulty: "HARD", description: "Reverse the linked list in-place (no new nodes).", signature: "void reverse_list(Node **head)", starterCode: "void reverse_list(Node **head) {\n\n}", solution: "void reverse_list(Node **head) {\n    Node *prev = NULL, *cur = *head, *next;\n    while (cur) {\n        next = cur->next;\n        cur->next = prev;\n        prev = cur;\n        cur = next;\n    }\n    *head = prev;\n}", hint: "Use three pointers: prev, cur, next. Reverse links one by one." },
            { id: "has_loop", name: "has_loop()", difficulty: "HARD", description: "Detect if a linked list has a cycle using Floyd's tortoise and hare algorithm.", signature: "int has_loop(Node *head)", starterCode: "int has_loop(Node *head) {\n\n}", solution: "int has_loop(Node *head) {\n    Node *slow = head, *fast = head;\n    while (fast && fast->next) {\n        slow = slow->next;\n        fast = fast->next->next;\n        if (slow == fast) return 1;\n    }\n    return 0;\n}", hint: "Use two pointers moving at different speeds. If they meet, there's a loop." },
            { id: "find_middle", name: "find_middle()", difficulty: "MEDIUM", description: "Find the middle node of a linked list in one pass using two pointers.", signature: "Node* find_middle(Node *head)", starterCode: "Node* find_middle(Node *head) {\n\n}", solution: "Node* find_middle(Node *head) {\n    Node *slow = head, *fast = head;\n    while (fast && fast->next) {\n        slow = slow->next;\n        fast = fast->next->next;\n    }\n    return slow;\n}", hint: "Slow moves 1 step, fast moves 2. When fast reaches end, slow is at middle." },
            { id: "loop_start", name: "loop_start()", difficulty: "HARD", description: "Find where a loop starts in a linked list — Floyd's phase 2.", signature: "Node* loop_start(Node *head)", starterCode: "Node* loop_start(Node *head) {\n\n}", solution: "Node* loop_start(Node *head) {\n    Node *slow = head, *fast = head;\n    while (fast && fast->next) {\n        slow = slow->next;\n        fast = fast->next->next;\n        if (slow == fast) break;\n    }\n    if (!fast || !fast->next) return NULL;\n    slow = head;\n    while (slow != fast) {\n        slow = slow->next;\n        fast = fast->next;\n    }\n    return slow;\n}", hint: "After detecting loop, reset slow to head. Move both 1 step until they meet." },
            { id: "delete_duplicates", name: "delete_duplicates()", difficulty: "HARD", description: "Remove all duplicate values from a sorted linked list in-place.", signature: "void delete_duplicates(Node **head)", starterCode: "void delete_duplicates(Node **head) {\n\n}", solution: "void delete_duplicates(Node **head) {\n    Node *cur = *head;\n    while (cur && cur->next) {\n        if (cur->data == cur->next->data) {\n            Node *tmp = cur->next;\n            cur->next = tmp->next;\n            free(tmp);\n        } else {\n            cur = cur->next;\n        }\n    }\n}", hint: "Since sorted, duplicates are adjacent. Compare cur with cur->next." },
        ]
    },
    "bst": {
        title: "Binary Search Tree",
        description: "Recursive tree operations and BST properties",
        icon: "B",
        color: "#f39c12",
        problems: [
            { id: "BST_insert", name: "BST_insert()", difficulty: "MEDIUM", description: "Recursively insert a key into a BST maintaining the BST property.", signature: "BSTNode* BST_insert(BSTNode *root, int key)", starterCode: "BSTNode* BST_insert(BSTNode *root, int key) {\n\n}", solution: "BSTNode* BST_insert(BSTNode *root, int key) {\n    if (!root) {\n        BSTNode *n = malloc(sizeof(BSTNode));\n        n->key = key; n->left = n->right = NULL;\n        return n;\n    }\n    if (key < root->key) root->left = BST_insert(root->left, key);\n    else if (key > root->key) root->right = BST_insert(root->right, key);\n    return root;\n}", hint: "Base case: NULL means create node. Recurse left if smaller, right if larger." },
            { id: "BST_search", name: "BST_search()", difficulty: "EASY", description: "Recursively search for a key and return its node pointer.", signature: "BSTNode* BST_search(BSTNode *root, int key)", starterCode: "BSTNode* BST_search(BSTNode *root, int key) {\n\n}", solution: "BSTNode* BST_search(BSTNode *root, int key) {\n    if (!root || root->key == key) return root;\n    if (key < root->key) return BST_search(root->left, key);\n    return BST_search(root->right, key);\n}", hint: "Compare key with root. Go left if smaller, right if larger." },
            { id: "inorder_traversal", name: "inorder_traversal()", difficulty: "EASY", description: "Print all keys in sorted order using in-order traversal.", signature: "void inorder_traversal(BSTNode *root)", starterCode: "void inorder_traversal(BSTNode *root) {\n\n}", solution: "void inorder_traversal(BSTNode *root) {\n    if (!root) return;\n    inorder_traversal(root->left);\n    printf(\"%d \", root->key);\n    inorder_traversal(root->right);\n}", hint: "Left, print, right. Base case: NULL returns." },
            { id: "postorder_free", name: "postorder_free()", difficulty: "MEDIUM", description: "Free all BST nodes using post-order traversal.", signature: "void postorder_free(BSTNode *root)", starterCode: "void postorder_free(BSTNode *root) {\n\n}", solution: "void postorder_free(BSTNode *root) {\n    if (!root) return;\n    postorder_free(root->left);\n    postorder_free(root->right);\n    free(root);\n}", hint: "Free children before parent. Left, right, then free current." },
            { id: "BST_height", name: "BST_height()", difficulty: "MEDIUM", description: "Compute the height (max depth) of a BST recursively.", signature: "int BST_height(BSTNode *root)", starterCode: "int BST_height(BSTNode *root) {\n\n}", solution: "int BST_height(BSTNode *root) {\n    if (!root) return -1;\n    int lh = BST_height(root->left);\n    int rh = BST_height(root->right);\n    return 1 + (lh > rh ? lh : rh);\n}", hint: "Height = 1 + max(left height, right height). Empty tree = -1." },
            { id: "BST_delete", name: "BST_delete()", difficulty: "HARD", description: "Delete a key handling all 3 cases: leaf, one child, two children.", signature: "BSTNode* BST_delete(BSTNode *root, int key)", starterCode: "BSTNode* BST_delete(BSTNode *root, int key) {\n\n}", solution: "BSTNode* BST_delete(BSTNode *root, int key) {\n    if (!root) return NULL;\n    if (key < root->key) root->left = BST_delete(root->left, key);\n    else if (key > root->key) root->right = BST_delete(root->right, key);\n    else {\n        if (!root->left) { BSTNode *t = root->right; free(root); return t; }\n        if (!root->right) { BSTNode *t = root->left; free(root); return t; }\n        BSTNode *succ = root->right;\n        while (succ->left) succ = succ->left;\n        root->key = succ->key;\n        root->right = BST_delete(root->right, succ->key);\n    }\n    return root;\n}", hint: "3 cases: leaf (free), one child (replace), two children (find in-order successor)." },
            { id: "BST_invert", name: "BST_invert()", difficulty: "MEDIUM", description: "Invert (mirror) a BST — swap left and right children at every node.", signature: "void BST_invert(BSTNode *root)", starterCode: "void BST_invert(BSTNode *root) {\n\n}", solution: "void BST_invert(BSTNode *root) {\n    if (!root) return;\n    BSTNode *tmp = root->left;\n    root->left = root->right;\n    root->right = tmp;\n    BST_invert(root->left);\n    BST_invert(root->right);\n}", hint: "Swap left and right, then recurse on both." },
            { id: "BST_is_balanced", name: "BST_is_balanced()", difficulty: "HARD", description: "Check if a BST is height-balanced — no subtree differs in height by more than 1.", signature: "int BST_is_balanced(BSTNode *root)", starterCode: "int BST_is_balanced(BSTNode *root) {\n\n}", solution: "int height(BSTNode *root) {\n    if (!root) return -1;\n    int lh = height(root->left);\n    int rh = height(root->right);\n    return 1 + (lh > rh ? lh : rh);\n}\n\nint BST_is_balanced(BSTNode *root) {\n    if (!root) return 1;\n    int lh = height(root->left);\n    int rh = height(root->right);\n    int diff = lh - rh;\n    if (diff < -1 || diff > 1) return 0;\n    return BST_is_balanced(root->left) && BST_is_balanced(root->right);\n}", hint: "Use a height helper. Check |left_height - right_height| <= 1 at every node." },
            { id: "preorder_print", name: "preorder_print()", difficulty: "EASY", description: "Print all BST keys in pre-order (root, left, right).", signature: "void preorder_print(BSTNode *root)", starterCode: "void preorder_print(BSTNode *root) {\n\n}", solution: "void preorder_print(BSTNode *root) {\n    if (!root) return;\n    printf(\"%d \", root->key);\n    preorder_print(root->left);\n    preorder_print(root->right);\n}", hint: "Print first, then recurse left, then right." },
            { id: "bst_count", name: "bst_count()", difficulty: "EASY", description: "Count total number of nodes in a BST.", signature: "int bst_count(BSTNode *root)", starterCode: "int bst_count(BSTNode *root) {\n\n}", solution: "int bst_count(BSTNode *root) {\n    if (!root) return 0;\n    return 1 + bst_count(root->left) + bst_count(root->right);\n}", hint: "1 + count(left) + count(right). Base: NULL = 0." },
            { id: "bst_max", name: "bst_max()", difficulty: "EASY", description: "Find the maximum key in a non-empty BST.", signature: "int bst_max(BSTNode *root)", starterCode: "int bst_max(BSTNode *root) {\n\n}", solution: "int bst_max(BSTNode *root) {\n    while (root->right) root = root->right;\n    return root->key;\n}", hint: "Keep going right until there's no right child." },
            { id: "bst_is_valid", name: "bst_is_valid()", difficulty: "HARD", description: "Check whether a binary tree satisfies the BST property.", signature: "int bst_is_valid(BSTNode *root)", starterCode: "int bst_is_valid(BSTNode *root) {\n\n}", solution: "int valid_helper(BSTNode *root, int min, int max) {\n    if (!root) return 1;\n    if (root->key <= min || root->key >= max) return 0;\n    return valid_helper(root->left, min, root->key) &&\n           valid_helper(root->right, root->key, max);\n}\n\nint bst_is_valid(BSTNode *root) {\n    return valid_helper(root, -2147483648, 2147483647);\n}", hint: "Use a helper with min/max bounds. Each node must be within range." },
        ]
    },
    "recursion": {
        title: "Recursion",
        description: "Build recursive thinking with classic problems",
        icon: "R",
        color: "#e74c3c",
        problems: [
            { id: "factorial", name: "factorial()", difficulty: "EASY", description: "Compute n! recursively with a clear base case.", signature: "int factorial(int n)", starterCode: "int factorial(int n) {\n\n}", solution: "int factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}", hint: "Base case: n <= 1 returns 1. Recursive: n * factorial(n-1)." },
            { id: "sum_array", name: "sum_array()", difficulty: "EASY", description: "Sum all elements of an array recursively.", signature: "int sum_array(int arr[], int n)", starterCode: "int sum_array(int arr[], int n) {\n\n}", solution: "int sum_array(int arr[], int n) {\n    if (n <= 0) return 0;\n    return arr[n-1] + sum_array(arr, n-1);\n}", hint: "Base: n=0 returns 0. Add last element + sum of rest." },
            { id: "count_nodes", name: "count_nodes()", difficulty: "EASY", description: "Count the number of nodes in a linked list recursively.", signature: "int count_nodes(Node *head)", starterCode: "int count_nodes(Node *head) {\n\n}", solution: "int count_nodes(Node *head) {\n    if (!head) return 0;\n    return 1 + count_nodes(head->next);\n}", hint: "Base: NULL = 0. Otherwise 1 + count rest." },
            { id: "fibonacci", name: "fibonacci()", difficulty: "MEDIUM", description: "Compute the nth Fibonacci number recursively.", signature: "int fibonacci(int n)", starterCode: "int fibonacci(int n) {\n\n}", solution: "int fibonacci(int n) {\n    if (n <= 0) return 0;\n    if (n == 1) return 1;\n    return fibonacci(n-1) + fibonacci(n-2);\n}", hint: "Base: fib(0)=0, fib(1)=1. Recursive: fib(n-1) + fib(n-2)." },
            { id: "sum_digits", name: "sum_digits()", difficulty: "EASY", description: "Recursively sum all digits of a non-negative integer.", signature: "int sum_digits(int n)", starterCode: "int sum_digits(int n) {\n\n}", solution: "int sum_digits(int n) {\n    if (n < 10) return n;\n    return (n % 10) + sum_digits(n / 10);\n}", hint: "Last digit = n%10. Remaining = n/10. Base: single digit." },
            { id: "string_length", name: "string_length()", difficulty: "EASY", description: "Compute string length recursively without strlen().", signature: "int string_length(char *s)", starterCode: "int string_length(char *s) {\n\n}", solution: "int string_length(char *s) {\n    if (*s == '\\0') return 0;\n    return 1 + string_length(s + 1);\n}", hint: "Base: null terminator = 0. Otherwise 1 + length of rest." },
            { id: "is_palindrome", name: "is_palindrome()", difficulty: "MEDIUM", description: "Check if a string is a palindrome using recursion.", signature: "int is_palindrome(char *s, int left, int right)", starterCode: "int is_palindrome(char *s, int left, int right) {\n\n}", solution: "int is_palindrome(char *s, int left, int right) {\n    if (left >= right) return 1;\n    if (s[left] != s[right]) return 0;\n    return is_palindrome(s, left + 1, right - 1);\n}", hint: "Compare outer chars. If equal, recurse inward. Base: pointers cross." },
            { id: "count_occurrences", name: "count_occurrences()", difficulty: "MEDIUM", description: "Count occurrences of a value in a linked list recursively.", signature: "int count_occurrences(Node *head, int val)", starterCode: "int count_occurrences(Node *head, int val) {\n\n}", solution: "int count_occurrences(Node *head, int val) {\n    if (!head) return 0;\n    int count = (head->data == val) ? 1 : 0;\n    return count + count_occurrences(head->next, val);\n}", hint: "Check current node, add 1 if match, recurse on next." },
            { id: "bst_min", name: "bst_min()", difficulty: "MEDIUM", description: "Find the minimum key in a BST recursively.", signature: "int bst_min(BSTNode *root)", starterCode: "int bst_min(BSTNode *root) {\n\n}", solution: "int bst_min(BSTNode *root) {\n    if (!root->left) return root->key;\n    return bst_min(root->left);\n}", hint: "Keep going left. No left child = minimum found." },
            { id: "flatten_list", name: "flatten_list()", difficulty: "HARD", description: "Reverse a linked list recursively — no loops allowed.", signature: "Node* flatten_list(Node *head)", starterCode: "Node* flatten_list(Node *head) {\n\n}", solution: "Node* flatten_list(Node *head) {\n    if (!head || !head->next) return head;\n    Node *rest = flatten_list(head->next);\n    head->next->next = head;\n    head->next = NULL;\n    return rest;\n}", hint: "Recurse to end. On return, reverse the link between current and next." },
            { id: "power", name: "power()", difficulty: "EASY", description: "Compute base^exp recursively.", signature: "int power(int base, int exp)", starterCode: "int power(int base, int exp) {\n\n}", solution: "int power(int base, int exp) {\n    if (exp == 0) return 1;\n    return base * power(base, exp - 1);\n}", hint: "Base case: exp=0 returns 1. Recursive: base * power(base, exp-1)." },
            { id: "tail_recursive_sum", name: "tail_recursive_sum()", difficulty: "HARD", description: "Write a TAIL-RECURSIVE sum that uses O(1) stack space.", signature: "int tail_sum(int n, int acc)", starterCode: "int tail_sum(int n, int acc) {\n\n}", solution: "int tail_sum(int n, int acc) {\n    if (n <= 0) return acc;\n    return tail_sum(n - 1, acc + n);\n}", hint: "Accumulate result in acc parameter. Base: n=0 return acc." },
        ]
    }
};

// --- Courses ---
const COURSES = {
    "csca48": {
        title: "CSCA48",
        description: "Introduction to Computer Science II",
        color: "#B89AD4",
        icon: "C",
        topics: ["linked-list", "bst", "recursion"],
    },
    "mata37": {
        title: "MATA37",
        description: "Calculus II for Mathematical Sciences",
        color: "#E8A0B4",
        icon: "M",
        topics: ["integration"],
        type: "answer",  // answer-only mode (no code editor)
    },
};

// --- Integration problems for MATA37 ---
TOPICS["integration"] = {
    title: "Integration",
    description: "Practice integral calculus techniques",
    icon: "I",
    color: "#E8A0B4",
    latex: true, // enable LaTeX rendering
    problems: [
        { id: "basic_integral", name: "Basic Integral", difficulty: "EASY", descLatex: "\\text{Evaluate: } \\int x^2 \\, dx", answer: "\\frac{x^3}{3} + C", solutionLatex: "\\frac{x^3}{3} + C \\\\[8pt] \\text{Power rule: } \\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C", hint: "Use the power rule: \\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C" },
        { id: "substitution", name: "U-Substitution", difficulty: "MEDIUM", descLatex: "\\text{Evaluate: } \\int 2x \\cos(x^2) \\, dx", answer: "\\sin(x^2) + C", solutionLatex: "\\sin(x^2) + C \\\\[8pt] \\text{Let } u = x^2, \\; du = 2x\\,dx \\\\[4pt] \\int \\cos(u)\\,du = \\sin(u) + C", hint: "Let u = x^2, then du = 2x\\,dx" },
        { id: "by_parts", name: "Integration by Parts", difficulty: "MEDIUM", descLatex: "\\text{Evaluate: } \\int x e^x \\, dx", answer: "e^x(x-1) + C", solutionLatex: "e^x(x - 1) + C \\\\[8pt] u = x, \\; dv = e^x dx \\\\[4pt] du = dx, \\; v = e^x \\\\[4pt] xe^x - \\int e^x dx = xe^x - e^x + C", hint: "Let u = x, \\; dv = e^x dx. \\; \\text{Apply } \\int u\\,dv = uv - \\int v\\,du" },
        { id: "partial_fractions", name: "Partial Fractions", difficulty: "HARD", descLatex: "\\text{Evaluate: } \\int \\frac{1}{(x-1)(x+2)} \\, dx", answer: "\\frac{1}{3}\\ln\\left|\\frac{x-1}{x+2}\\right| + C", solutionLatex: "\\frac{1}{3}\\ln\\left|\\frac{x-1}{x+2}\\right| + C \\\\[8pt] \\frac{1}{(x-1)(x+2)} = \\frac{A}{x-1} + \\frac{B}{x+2} \\\\[4pt] A = \\frac{1}{3}, \\; B = -\\frac{1}{3}", hint: "Decompose: \\frac{A}{x-1} + \\frac{B}{x+2}" },
        { id: "trig_sub", name: "Trig Substitution", difficulty: "HARD", descLatex: "\\text{Evaluate: } \\int \\frac{1}{\\sqrt{1-x^2}} \\, dx", answer: "\\arcsin(x) + C", solutionLatex: "\\arcsin(x) + C \\\\[8pt] \\text{Let } x = \\sin(t), \\; dx = \\cos(t)\\,dt \\\\[4pt] \\sqrt{1-x^2} = \\cos(t) \\\\[4pt] \\int 1\\,dt = t + C = \\arcsin(x) + C", hint: "Let x = \\sin(t), \\text{ then } \\sqrt{1-x^2} = \\cos(t)" },
        { id: "definite_integral", name: "Definite Integral", difficulty: "EASY", descLatex: "\\text{Evaluate: } \\int_0^2 3x^2 \\, dx", answer: "8", solutionLatex: "8 \\\\[8pt] \\int 3x^2\\,dx = x^3 \\\\[4pt] F(2) - F(0) = 8 - 0 = 8", hint: "\\text{Antiderivative of } 3x^2 \\text{ is } x^3. \\text{ Then } F(2) - F(0)." },
        { id: "improper_integral", name: "Improper Integral", difficulty: "HARD", descLatex: "\\text{Evaluate: } \\int_1^{\\infty} \\frac{1}{x^2} \\, dx", answer: "1", solutionLatex: "1 \\\\[8pt] \\int x^{-2}\\,dx = -\\frac{1}{x} \\\\[4pt] \\lim_{b \\to \\infty} \\left[-\\frac{1}{b} + 1\\right] = 1", hint: "\\text{Antiderivative of } \\frac{1}{x^2} = -\\frac{1}{x}. \\text{ Take limit.}" },
        { id: "area_between", name: "Area Between Curves", difficulty: "MEDIUM", descLatex: "\\text{Find the area between } y = x^2 \\text{ and } y = x \\text{ from } x=0 \\text{ to } x=1.", answer: "\\frac{1}{6}", solutionLatex: "\\frac{1}{6} \\\\[8pt] \\int_0^1 (x - x^2)\\,dx = \\left[\\frac{x^2}{2} - \\frac{x^3}{3}\\right]_0^1 = \\frac{1}{2} - \\frac{1}{3} = \\frac{1}{6}", hint: "y = x \\text{ is on top. Area} = \\int_0^1 (x - x^2)\\,dx" },
        { id: "volume_revolution", name: "Volume of Revolution", difficulty: "HARD", descLatex: "\\text{Volume when } y = \\sqrt{x} \\text{ is revolved around the x-axis from } x=0 \\text{ to } x=4.", answer: "8\\pi", solutionLatex: "8\\pi \\\\[8pt] V = \\pi\\int_0^4 (\\sqrt{x})^2\\,dx = \\pi\\int_0^4 x\\,dx = \\pi\\left[\\frac{x^2}{2}\\right]_0^4 = 8\\pi", hint: "\\text{Disk method: } V = \\pi\\int [f(x)]^2\\,dx" },
        { id: "integration_trig", name: "Trig Integrals", difficulty: "MEDIUM", descLatex: "\\text{Evaluate: } \\int \\sin^2(x) \\, dx", answer: "\\frac{x}{2} - \\frac{\\sin(2x)}{4} + C", solutionLatex: "\\frac{x}{2} - \\frac{\\sin(2x)}{4} + C \\\\[8pt] \\sin^2(x) = \\frac{1 - \\cos(2x)}{2}", hint: "\\text{Half-angle identity: } \\sin^2(x) = \\frac{1 - \\cos(2x)}{2}" },
    ]
};

// --- Practice Navigation ---
let currentCourse = null;
let currentTopic = null;
let currentProblem = null;

function showPracticeCourses() {
    document.getElementById("practice-courses").style.display = "block";
    document.getElementById("practice-topics").style.display = "none";
    document.getElementById("practice-questions").style.display = "none";
    document.getElementById("practice-challenge").style.display = "none";

    const grid = document.getElementById("course-grid");
    grid.innerHTML = "";
    for (const [key, course] of Object.entries(COURSES)) {
        const topicCount = course.topics.reduce((sum, t) => sum + (TOPICS[t] ? TOPICS[t].problems.length : 0), 0);
        const card = document.createElement("div");
        card.className = "topic-card";
        card.innerHTML = `
            <div class="topic-icon" style="background:${course.color}">${course.icon}</div>
            <h3>${course.title}</h3>
            <p>${course.description}</p>
            <span class="topic-count">${topicCount} problems</span>
        `;
        card.addEventListener("click", () => showCourseTopics(key));
        grid.appendChild(card);
    }
}

async function loadCustomTopics(courseKey) {
    try {
        const res = await fetch(`/api/custom-topics?course=${courseKey}`);
        const data = await res.json();
        if (data.ok) {
            const course = COURSES[courseKey];
            for (const t of data.topics) {
                // Add topic to TOPICS if not exists
                if (!TOPICS[t.topic_key]) {
                    TOPICS[t.topic_key] = {
                        title: t.title,
                        description: t.description,
                        icon: t.icon,
                        color: t.color,
                        latex: true,
                        problems: [],
                        _customId: t.id,
                    };
                }
                // Add to course topics list if not there
                if (!course.topics.includes(t.topic_key)) {
                    course.topics.push(t.topic_key);
                }
            }
        }
    } catch(e) {}
}

async function showCourseTopics(courseKey) {
    currentCourse = courseKey;
    const course = COURSES[courseKey];

    // Load custom topics for MATA37
    if (courseKey === "mata37") {
        await loadCustomTopics(courseKey);
        await loadCustomQuestions();
    }

    document.getElementById("practice-courses").style.display = "none";
    document.getElementById("practice-topics").style.display = "block";
    document.getElementById("practice-questions").style.display = "none";
    document.getElementById("practice-challenge").style.display = "none";
    document.getElementById("topics-title").textContent = course.title;

    // Hide add topic form
    const addForm = document.getElementById("add-topic-form");
    if (addForm) addForm.style.display = "none";

    const grid = document.getElementById("topic-grid");
    grid.innerHTML = "";

    // "Add Topic" card for contributors in MATA37
    const isContrib = typeof currentRole !== "undefined" && currentRole === "contributor";
    if (courseKey === "mata37" && isContrib) {
        const addBtn = document.createElement("div");
        addBtn.className = "topic-card add-question-card";
        addBtn.innerHTML = `<span style="font-size:32px;">+</span><h3>Add Topic</h3><p>Create a new topic</p>`;
        addBtn.addEventListener("click", () => {
            const form = document.getElementById("add-topic-form");
            if (form) form.style.display = form.style.display === "none" ? "block" : "none";
        });
        grid.appendChild(addBtn);
    }

    for (const topicKey of course.topics) {
        const topic = TOPICS[topicKey];
        if (!topic) continue;
        const card = document.createElement("div");
        card.className = "topic-card";
        card.style.position = "relative";

        // Delete button for ALL topics in MATA37 (contributor only)
        const isCustomTopic = topic._customId;
        const deleteBtn = (isContrib && courseKey === "mata37")
            ? `<button class="delete-q-btn delete-topic-btn" data-id="${isCustomTopic || ''}" title="Delete topic">&times;</button>`
            : "";

        card.innerHTML = `
            ${deleteBtn}
            <div class="topic-icon" style="background:${topic.color}">${topic.icon}</div>
            <h3>${topic.title}</h3>
            <p>${topic.description}</p>
            <span class="topic-count">${topic.problems.length} problems</span>
        `;

        // Delete topic handler
        const delEl = card.querySelector(".delete-topic-btn");
        if (delEl) {
            delEl.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete topic "${topic.title}" and all its questions?`)) return;

                // Delete from DB if it's a custom topic
                if (isCustomTopic) {
                    try {
                        const res = await fetch(`/api/custom-topics/${isCustomTopic}`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: currentUser }),
                        });
                        const data = await res.json();
                        if (!data.ok) { alert(data.error); return; }
                    } catch(err) { alert("Connection error."); return; }
                }

                // Remove from JS
                delete TOPICS[topicKey];
                const idx = course.topics.indexOf(topicKey);
                if (idx !== -1) course.topics.splice(idx, 1);
                showCourseTopics(courseKey);
            });
        }

        card.addEventListener("click", () => showQuestions(topicKey));
        grid.appendChild(card);
    }
}

// Keep old function name for compatibility
function showPracticeTopics() {
    showPracticeCourses();
}

// Load custom questions from DB and merge into their topics
async function loadCustomQuestions() {
    try {
        const res = await fetch("/api/custom-questions?course=mata37");
        const data = await res.json();
        if (data.ok && data.questions.length > 0) {
            for (const q of data.questions) {
                const topicKey = q.topic || "integration";
                if (!TOPICS[topicKey]) continue;
                // Remove old version if exists
                TOPICS[topicKey].problems = TOPICS[topicKey].problems.filter(p => p.id !== q.id);
                TOPICS[topicKey].problems.push({
                    id: q.id, name: q.name, difficulty: q.difficulty,
                    descLatex: q.descLatex, answer: q.answer,
                    solutionLatex: q.solutionLatex, hint: q.hint,
                    created_by: q.created_by,
                });
            }
        }
    } catch (e) { /* ignore */ }
}

async function showQuestions(topicKey) {
    currentTopic = topicKey;
    const topic = TOPICS[topicKey];

    // Load custom questions from DB before showing
    if (currentCourse === "mata37") {
        await loadCustomQuestions();
    }

    document.getElementById("practice-courses").style.display = "none";
    document.getElementById("practice-topics").style.display = "none";
    document.getElementById("practice-questions").style.display = "block";
    document.getElementById("practice-challenge").style.display = "none";
    document.getElementById("questions-title").textContent = topic.title;

    // Hide add question form
    const addForm = document.getElementById("add-question-form");
    if (addForm) addForm.style.display = "none";

    const grid = document.getElementById("questions-grid");
    grid.innerHTML = "";

    // Show "Add Question" button for contributors in MATA37
    if (currentCourse === "mata37" && typeof currentRole !== "undefined" && currentRole === "contributor") {
        const addBtn = document.createElement("div");
        addBtn.className = "question-card add-question-card";
        addBtn.innerHTML = `<span style="font-size:32px;">+</span><h4>Add Question</h4><p>Create a new practice problem</p>`;
        addBtn.addEventListener("click", () => {
            const form = document.getElementById("add-question-form");
            if (form) form.style.display = form.style.display === "none" ? "block" : "none";
        });
        grid.appendChild(addBtn);
    }

    for (const prob of topic.problems) {
        const card = document.createElement("div");
        card.className = "question-card";
        const diffClass = prob.difficulty.toLowerCase();
        // Render LaTeX description for display in card if available
        let descText = prob.description || "";
        if (prob.descLatex && typeof katex !== "undefined") {
            try { descText = katex.renderToString(prob.descLatex, { throwOnError: false }); } catch(e) {}
        }
        // Add delete button for contributors on ALL questions in MATA37
        const isContrib = typeof currentRole !== "undefined" && currentRole === "contributor";
        const showDelete = isContrib && currentCourse === "mata37";
        const isCustom = prob.id && prob.id.startsWith("custom_");
        const deleteBtn = showDelete
            ? `<button class="delete-q-btn" data-id="${prob.id}" title="Delete question">&times;</button>`
            : "";

        card.innerHTML = `
            ${deleteBtn}
            <span class="diff-badge ${diffClass}">${prob.difficulty}</span>
            <h4>${prob.name}</h4>
            <p>${descText}</p>
        `;

        // Delete button click (stop propagation so it doesn't open the question)
        const delEl = card.querySelector(".delete-q-btn");
        if (delEl) {
            delEl.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete "${prob.name}"?`)) return;

                if (isCustom) {
                    // Delete from database
                    const dbId = prob.id.replace("custom_", "");
                    try {
                        const res = await fetch(`/api/custom-questions/${dbId}`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: currentUser }),
                        });
                        const data = await res.json();
                        if (!data.ok) { alert(data.error || "Failed to delete."); return; }
                    } catch (err) { alert("Connection error."); return; }
                }

                // Remove from JS array
                const idx = topic.problems.findIndex(p => p.id === prob.id);
                if (idx !== -1) topic.problems.splice(idx, 1);
                showQuestions(topicKey); // refresh
            });
        }

        card.addEventListener("click", () => showChallenge(topicKey, prob.id));
        grid.appendChild(card);
    }
}

// Check if current course is answer-only mode
function isAnswerMode() {
    return currentCourse && COURSES[currentCourse] && COURSES[currentCourse].type === "answer";
}

function showChallenge(topicKey, problemId) {
    const topic = TOPICS[topicKey];
    const prob = topic.problems.find(p => p.id === problemId);
    if (!prob) return;

    currentTopic = topicKey;
    currentProblem = prob;

    document.getElementById("practice-courses").style.display = "none";
    document.getElementById("practice-topics").style.display = "none";
    document.getElementById("practice-questions").style.display = "none";
    document.getElementById("practice-challenge").style.display = "block";

    document.getElementById("challenge-title").textContent = prob.name;
    document.getElementById("challenge-topic").textContent = topic.title;
    const diffEl = document.getElementById("challenge-diff");
    diffEl.textContent = prob.difficulty;
    diffEl.className = "diff-badge " + prob.difficulty.toLowerCase();
    // Render description — LaTeX or plain text
    const descEl = document.getElementById("challenge-desc");
    if (prob.descLatex && typeof katex !== "undefined") {
        try {
            descEl.innerHTML = katex.renderToString(prob.descLatex, { throwOnError: false, displayMode: true });
        } catch (e) {
            descEl.textContent = prob.description || prob.descLatex;
        }
    } else {
        descEl.textContent = prob.description || "";
    }

    // Signature (hide for answer mode)
    const sigEl = document.getElementById("challenge-sig");
    if (prob.signature) {
        sigEl.textContent = "Signature: " + prob.signature;
        sigEl.style.display = "block";
    } else {
        sigEl.style.display = "none";
    }

    // Struct definition
    const structEl = document.getElementById("challenge-struct");
    if (STRUCT_DEFS[topicKey]) {
        structEl.style.display = "block";
        structEl.querySelector("code").textContent = STRUCT_DEFS[topicKey];
    } else {
        structEl.style.display = "none";
    }

    // Switch between code editor and answer input
    const codeEditor = document.getElementById("code-editor");
    const answerBox = document.getElementById("answer-box");
    const editorLabel = document.querySelector(".editor-label");
    const checkBtn = document.querySelector(".btn-check");

    if (isAnswerMode()) {
        codeEditor.style.display = "none";
        answerBox.style.display = "block";
        document.getElementById("answer-input").value = "";
        editorLabel.textContent = "Your answer:";
        checkBtn.textContent = "Check Answer";
    } else {
        codeEditor.style.display = "block";
        answerBox.style.display = "none";
        codeEditor.value = prob.starterCode || "";
        editorLabel.textContent = "// Your implementation:";
        checkBtn.textContent = "Check with AI";
    }

    // Reset result area
    document.getElementById("ai-result").style.display = "none";
    document.getElementById("hint-box").style.display = "none";
    document.getElementById("solution-box").style.display = "none";
}

// --- AI Check / Answer Check ---
async function checkWithAI() {
    if (!currentProblem) return;
    const resultEl = document.getElementById("ai-result");
    resultEl.style.display = "block";

    // Answer mode — send to Gemini AI for checking
    if (isAnswerMode()) {
        const userAnswer = document.getElementById("answer-input").value.trim();
        if (!userAnswer) {
            resultEl.innerHTML = '<div class="ai-error">Please enter your answer.</div>';
            return;
        }
        resultEl.innerHTML = '<div class="ai-loading">Checking with AI...</div>';

        try {
            const res = await fetch("/api/check-math", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problem: currentProblem.descLatex || currentProblem.name,
                    answer: userAnswer,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                const text = data.response.trim();
                const isCorrect = text.toUpperCase().startsWith("CORRECT");
                const isWrong = text.toUpperCase().startsWith("WRONG");
                let badge = "";
                if (isCorrect) {
                    badge = '<div class="result-badge correct">CORRECT</div>';
                    recordPracticeSolve();
                }
                else if (isWrong) badge = '<div class="result-badge wrong">WRONG</div>';
                const explanation = text.replace(/^(CORRECT|WRONG)\s*/i, "");
                resultEl.innerHTML = `${badge}<div class="ai-response">${formatAIResponse(explanation)}</div>`;
            } else {
                resultEl.innerHTML = `<div class="ai-error">Error: ${data.error || "AI check failed."}</div>`;
            }
        } catch (err) {
            resultEl.innerHTML = '<div class="ai-error">Connection error.</div>';
        }
        return;
    }

    // Code mode — send to Gemini AI
    const code = document.getElementById("code-editor").value;
    resultEl.innerHTML = '<div class="ai-loading">Checking with AI...</div>';

    try {
        const res = await fetch("/api/check-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                topic: currentTopic,
                problem_id: currentProblem.id,
                problem_name: currentProblem.name,
                description: currentProblem.description,
                signature: currentProblem.signature,
                code: code,
            }),
        });
        const data = await res.json();
        if (data.ok) {
            const text = data.response.trim();
            const isCorrect = text.toUpperCase().startsWith("CORRECT");
            const isWrong = text.toUpperCase().startsWith("WRONG");
            let badge = "";
            if (isCorrect) {
                badge = '<div class="result-badge correct">CORRECT</div>';
                recordPracticeSolve();
            } else if (isWrong) {
                badge = '<div class="result-badge wrong">WRONG</div>';
            }
            // Remove the first line (CORRECT/WRONG) from explanation
            const explanation = text.replace(/^(CORRECT|WRONG)\s*/i, "");
            resultEl.innerHTML = `${badge}<div class="ai-response">${formatAIResponse(explanation)}</div>`;
        } else {
            resultEl.innerHTML = `<div class="ai-error">Error: ${data.error || "AI check failed."}</div>`;
        }
    } catch (err) {
        resultEl.innerHTML = `<div class="ai-error">Connection error: ${err.message}</div>`;
    }
}

function formatAIResponse(text) {
    // First render LaTeX: $...$ inline and $$...$$ display
    if (typeof katex !== "undefined") {
        // Display math $$...$$
        text = text.replace(/\$\$([^$]+)\$\$/g, (_, latex) => {
            try { return katex.renderToString(latex.trim(), { throwOnError: false, displayMode: true }); }
            catch(e) { return `$$${latex}$$`; }
        });
        // Inline math $...$
        text = text.replace(/\$([^$]+)\$/g, (_, latex) => {
            try { return katex.renderToString(latex.trim(), { throwOnError: false, displayMode: false }); }
            catch(e) { return `$${latex}$`; }
        });
    }
    return text
        .replace(/\n/g, "<br>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// --- Hint / Solution ---
function renderLatexOrText(el, latexStr, plainStr) {
    if (latexStr && typeof katex !== "undefined") {
        try {
            el.innerHTML = katex.renderToString(latexStr, { throwOnError: false, displayMode: true });
        } catch (e) {
            el.textContent = plainStr || latexStr;
        }
    } else {
        el.textContent = plainStr || "";
    }
}

function showHint() {
    if (!currentProblem) return;
    const box = document.getElementById("hint-box");
    box.style.display = "block";
    const topic = TOPICS[currentTopic];
    if (topic && topic.latex && typeof katex !== "undefined") {
        try {
            box.innerHTML = katex.renderToString(currentProblem.hint, { throwOnError: false, displayMode: false });
        } catch (e) {
            box.textContent = currentProblem.hint;
        }
    } else {
        box.textContent = currentProblem.hint;
    }
}

function showSolution() {
    if (!currentProblem) return;
    const box = document.getElementById("solution-box");
    box.style.display = "block";
    const codeEl = box.querySelector("code");
    const topic = TOPICS[currentTopic];
    if (topic && topic.latex && currentProblem.solutionLatex && typeof katex !== "undefined") {
        try {
            codeEl.innerHTML = katex.renderToString(currentProblem.solutionLatex, { throwOnError: false, displayMode: true });
        } catch (e) {
            codeEl.textContent = currentProblem.solution || currentProblem.solutionLatex;
        }
    } else {
        codeEl.textContent = currentProblem.solution;
    }
}

// --- Submit new topic (contributor) ---
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("at-submit");
    if (btn) {
        btn.addEventListener("click", async () => {
            const title = document.getElementById("at-title").value.trim();
            const description = document.getElementById("at-desc").value.trim();
            const icon = document.getElementById("at-icon").value.trim() || title.charAt(0).toUpperCase();
            const color = document.getElementById("at-color").value;
            const status = document.getElementById("at-status");

            if (!title) { status.textContent = "Title is required."; status.style.color = "#BE123C"; return; }

            try {
                const res = await fetch("/api/custom-topics", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: currentUser, course: "mata37", title, description, icon, color }),
                });
                const data = await res.json();
                if (data.ok) {
                    status.textContent = "Topic created!"; status.style.color = "#1B7A1B";
                    document.getElementById("at-title").value = "";
                    document.getElementById("at-desc").value = "";
                    document.getElementById("at-icon").value = "";
                    showCourseTopics(currentCourse);
                } else {
                    status.textContent = data.error || "Failed."; status.style.color = "#BE123C";
                }
            } catch(e) { status.textContent = "Connection error."; status.style.color = "#BE123C"; }
        });
    }
});

// --- Submit new question (contributor) ---
document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("aq-submit");
    if (submitBtn) {
        submitBtn.addEventListener("click", async () => {
            const name = document.getElementById("aq-name").value.trim();
            const difficulty = document.getElementById("aq-difficulty").value;
            const descLatex = document.getElementById("aq-desc").value.trim();
            const status = document.getElementById("aq-status");

            if (!name || !descLatex) {
                status.textContent = "Name and description are required.";
                status.style.color = "#BE123C";
                return;
            }

            try {
                const res = await fetch("/api/custom-questions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: currentUser,
                        course: "mata37", topic: currentTopic,
                        name, difficulty, descLatex,
                        answer: "", solutionLatex: "", hint: "",
                    }),
                });
                const data = await res.json();
                if (data.ok) {
                    status.textContent = "Question added!";
                    status.style.color = "#1B7A1B";
                    // Clear form
                    document.getElementById("aq-name").value = "";
                    document.getElementById("aq-desc").value = "";
                    document.getElementById("aq-desc-preview").innerHTML = "";
                    // Refresh question list
                    showQuestions(currentTopic);
                } else {
                    status.textContent = data.error || "Failed to add.";
                    status.style.color = "#BE123C";
                }
            } catch (e) {
                status.textContent = "Connection error.";
                status.style.color = "#BE123C";
            }
        });
    }

    // LaTeX preview for add question form
    function setupPreview(inputId, previewId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        if (input && preview) {
            input.addEventListener("input", () => {
                const val = input.value.trim();
                if (!val) { preview.innerHTML = ""; return; }
                if (typeof katex !== "undefined") {
                    try { preview.innerHTML = katex.renderToString(val, { throwOnError: false, displayMode: true }); }
                    catch(e) { preview.textContent = val; }
                }
            });
        }
    }
    setupPreview("aq-desc", "aq-desc-preview");
});

// --- Record solve for leaderboard ---
function recordPracticeSolve() {
    if (!currentProblem || !currentUser) return;
    fetch("/api/practice-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: currentUser,
            course: currentCourse || "",
            topic: currentTopic || "",
            problem_id: currentProblem.id,
            difficulty: currentProblem.difficulty,
        }),
    }).catch(() => {});
}

// --- Tab key in editor + Live LaTeX preview ---
document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("code-editor");
    if (editor) {
        editor.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const start = editor.selectionStart;
                editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(editor.selectionEnd);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });
    }

    // Live LaTeX preview for answer input
    const answerInput = document.getElementById("answer-input");
    const answerPreview = document.getElementById("answer-preview");
    if (answerInput && answerPreview) {
        answerInput.addEventListener("input", () => {
            const val = answerInput.value.trim();
            if (!val) {
                answerPreview.innerHTML = '<span style="color:#aaa;">Preview will appear here</span>';
                return;
            }
            if (typeof katex !== "undefined") {
                try {
                    answerPreview.innerHTML = katex.renderToString(val, { throwOnError: false, displayMode: true });
                } catch (e) {
                    answerPreview.textContent = val;
                }
            } else {
                answerPreview.textContent = val;
            }
        });
    }
});
