const cluster = require('cluster');
const http = require('http');
const os = require('os');
const queue = [];
let isProcessing = false;

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  // Master process: Distribute tasks to workers
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Receive requests from workers after they finish processing
  cluster.on('message', (worker, message) => {
    if (message === 'task_done') {
      console.log(`Worker ${worker.process.pid} finished a task`);
      processQueue(); // Process the next task in the queue
    }
  });

  // Incoming client request (could come from any source)
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      queue.push({ req, res }); // Add request to the queue
      processQueue(); // Process the queue
    }
  });

  server.listen(8000, () => {
    console.log('Server listening on port 8000');
  });

  // Function to process the next task in the queue
  function processQueue() {
    if (queue.length > 0 && !isProcessing) {
      isProcessing = true;
      const { req, res } = queue.shift(); // Dequeue request
      const worker = Object.values(cluster.workers).pop(); // Assign a worker

      if (worker) {
        worker.send('process_task'); // Send a task to the worker
        worker.on('message', () => {
          res.writeHead(200);
          res.end('Task completed!'); // Notify the client
          isProcessing = false; // Reset processing status
          worker.removeAllListeners('message'); // Avoid memory leaks
        });
      }
    }
  }
  
} else {
  // Worker process: Execute tasks sent by the master
  console.log(`Worker ${process.pid} started`);

  process.on('message', (message) => {
    if (message === 'process_task') {
      console.log(`Worker ${process.pid} processing a task...`);

      // Simulate task processing with a timeout
      setTimeout(() => {
        process.send('task_done'); // Notify master that task is done
      }, 2000); // 2-second delay to simulate a task
    }
  });
}
