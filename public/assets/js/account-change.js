/**
 * @param {string} linkedWalletAddress
 */
function listenForAccountChange(linkedWalletAddress) {

  if (!linkedWalletAddress || typeof window.ethereum === "undefined") {
    return;
  }

  const linkedWallet = linkedWalletAddress.toLowerCase();

  window.ethereum.on("accountsChanged", function (accounts) {
    const currentAccount = accounts[0]?.toLowerCase();

    console.log(
      "Phat hiện thay đổi tài khoản ví:",
      currentAccount,
      "ví đã liên kết:",
      linkedWallet
    );

    // Nếu tài khoản thay đổi khác với tài khoản đã liên kết, đăng xuất người dùng
    if (!currentAccount || currentAccount !== linkedWallet) {
      toastr.warning("Phát hiện thay đổi ví. Hệ thống sẽ tự động đăng xuất.");
      setTimeout(() => (window.location.href = "/auth/logout"), 2000);
    }
  });
}
