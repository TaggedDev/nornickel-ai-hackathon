using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScientificTangle.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(ScientificTangleIdentityDbContext))]
    [Migration("20260704223000_AddChatKnowledgeContext")]
    public partial class AddChatKnowledgeContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "KnowledgeContextJson",
                table: "Chats",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KnowledgeContextJson",
                table: "Chats");
        }
    }
}
