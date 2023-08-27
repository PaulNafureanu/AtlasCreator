import chalk from "chalk";

const errorHandler = (err: Error) => {
  const errorMessages = [`Atlas could not be created. `, err];
  console.error(chalk.red(...errorMessages));
};

export default errorHandler;
