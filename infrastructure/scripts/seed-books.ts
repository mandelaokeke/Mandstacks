import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const tableName = process.env.BOOKS_TABLE_NAME;
if (!tableName) throw new Error("BOOKS_TABLE_NAME is required");

const books = [
  { bookId: "the-midnight-library", title: "The Midnight Library", author: "Matt Haig", isbn: "9780525559474", category: "Fiction", publisher: "Viking", description: "Between life and death there is a library, and within that library, the shelves go on forever. A moving exploration of regret, hope, and the lives we might have lived.", totalCopies: 5 },
  { bookId: "atomic-habits", title: "Atomic Habits", author: "James Clear", isbn: "9780735211292", category: "Personal Growth", publisher: "Avery", description: "A practical guide to building good habits, breaking bad ones, and mastering the tiny behaviors that lead to remarkable results.", totalCopies: 4 },
  { bookId: "educated", title: "Educated", author: "Tara Westover", isbn: "9780399590504", category: "Memoir", publisher: "Random House", description: "A memoir about a young woman who leaves an isolated upbringing and discovers the transforming power of education.", totalCopies: 3 },
  { bookId: "project-hail-mary", title: "Project Hail Mary", author: "Andy Weir", isbn: "9780593135204", category: "Science Fiction", publisher: "Ballantine", description: "A lone astronaut must save Earth from disaster in this inventive story of discovery, survival, and unexpected friendship.", totalCopies: 6 },
  { bookId: "the-design-of-everyday-things", title: "The Design of Everyday Things", author: "Don Norman", isbn: "9780465050659", category: "Design", publisher: "Basic Books", description: "A foundational examination of how thoughtful design serves as communication between object and user.", totalCopies: 2 },
  { bookId: "braiding-sweetgrass", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", isbn: "9781571313560", category: "Nature", publisher: "Milkweed Editions", description: "Indigenous wisdom, scientific knowledge, and the teachings of plants woven into a celebration of our relationship with the natural world.", totalCopies: 4 },
];

async function main() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const now = new Date().toISOString();
  let created = 0;

  for (const book of books) {
    try {
      await client.send(new PutCommand({
        TableName: tableName,
        Item: {
          ...book,
          titleSort: book.title.toLowerCase(),
          searchTitle: book.title.toLowerCase(),
          searchAuthor: book.author.toLowerCase(),
          availableCopies: book.totalCopies,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(bookId)",
      }));
      created += 1;
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
    }
  }

  console.log(`Catalog ready: ${created} created, ${books.length - created} already present.`);
}

void main();
