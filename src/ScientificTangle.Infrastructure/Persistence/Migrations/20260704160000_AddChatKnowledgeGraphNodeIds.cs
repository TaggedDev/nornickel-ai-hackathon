using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScientificTangle.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddChatKnowledgeGraphNodeIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RepresentedKnowledgeGraphNodeIdsJson",
                table: "Chats",
                type: "text",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RepresentedKnowledgeGraphNodeIdsJson",
                table: "Chats");
        }
    }
}
