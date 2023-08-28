import chalk from "chalk";

const errorHandler = (err: Error) => {
  console.error(chalk.red(`Atlas could not be created.`));
  console.error(err);
};

export default errorHandler;
