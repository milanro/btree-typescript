

async function waitSomeTime(timeToWait: number, label: string ): Promise<string> {
      return new Promise((resolve, reject) => {
         setTimeout(() => {
               console.log(label);
               resolve(label);
         }, timeToWait);
      });
}


const p1 = waitSomeTime(2000, 'first');
const p2 = waitSomeTime(500, 'second');

p1.then((label) => {
      console.log("Done " + label);
});


p2.then((label) => {
   console.log("Done " + label);
});

