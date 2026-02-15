# Code Samples

## Creating an Agent
```javascript
// Example using OpenGoat API (conceptual)
const opengoat = require('opengoat');

opengoat.agent.create({
  name: 'MyAgent',
  type: 'individual',
  reportsTo: 'ceo',
  skills: ['coding']
});
```

## Task Assignment
```bash
opengoat task create --title "Implement auth" --description "Add login system" --assign myagent
```
